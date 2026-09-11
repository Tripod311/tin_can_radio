package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"tripod311/tin_can_radio/api"
)

type Config struct {
	Port              int         `json:"port"`
	Tls               TlsConf     `json:"tls"`
	BroadcastPassword string      `json:"broadcastPassword"`
	ICEServers        []ICEServer `json:"iceServers"`

	Description StationDescription `json:"description"`
}

func main() {
	bytes, err := os.ReadFile("config.json")
	if err != nil {
		log.Fatalf("error on reading config.json: %s", err)
	}

	var config Config
	err = json.Unmarshal(bytes, &config)
	if err != nil {
		log.Fatalf("corrupted config.json: %s", err)
	}

	clientPath := flag.String(
		"client",
		"./client_dist",
		"path to client directory",
	)

	flag.Parse()

	serverInst := NewServer(*clientPath, config)
	apiInst := api.NewAPI(serverInst.Config.Description.Title, serverInst.Config.Description.Description, serverInst.Config.BroadcastPassword)
	apiInst.Register(serverInst.Mux)
	radioInst, err := NewRadio(config.ICEServers)
	if err != nil {
		log.Fatalf("failed to start radio: %s", err)
	}
	apiInst.Radio = radioInst
	radioInst.Start()

	errChan := make(chan error, 1)
	go func() {
		errChan <- serverInst.Start()
	}()

	signals := make(chan os.Signal, 1)

	signal.Notify(
		signals,
		os.Interrupt,
	)
	defer signal.Stop(signals)

	select {
	case receivedSignal := <-signals:
		fmt.Printf("Received signal %s\n", receivedSignal)
	case err := <-errChan:
		fmt.Printf("Received error: %s\n", err)
	}

	serverInst.Stop()
	apiInst.Shutdown()
}
