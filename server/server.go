package main

import (
	"context"
	"fmt"
	"mime"
	"net/http"
	"path"
	"time"
)

type TlsConf struct {
	Cert string `json:"cert"`
	Key  string `json:"key"`
}

type StationDescription struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type SPAServer struct {
	rootDir http.FileSystem
}

func (spa *SPAServer) Serve(w http.ResponseWriter, r *http.Request) {
	fileServer := http.FileServer(spa.rootDir)
	p := path.Clean(r.URL.Path)

	f, err := spa.rootDir.Open(p)
	if err == nil {
		info, statErr := f.Stat()
		f.Close()

		if statErr == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}
	}

	fallbackRequest := r.Clone(r.Context())
	fallbackRequest.URL.Path = "/"
	fallbackRequest.URL.RawPath = ""

	fileServer.ServeHTTP(w, fallbackRequest)
}

type Server struct {
	Config  *Config
	Statics *SPAServer
	Mux     *http.ServeMux

	instance *http.Server
}

func NewServer(clientDir string, config Config) *Server {
	statics := SPAServer{
		rootDir: http.Dir(clientDir),
	}

	result := Server{
		Config:  &config,
		Statics: &statics,
		Mux:     http.NewServeMux(),
	}

	result.Mux.HandleFunc("/", result.Statics.Serve)

	return &result
}

func (server *Server) Start() error {
	if err := mime.AddExtensionType(
		".webmanifest",
		"application/manifest+json",
	); err != nil {
		return err
	}

	server.instance = &http.Server{
		Addr:    fmt.Sprintf("0.0.0.0:%d", server.Config.Port),
		Handler: server.Mux,
	}

	cert := server.Config.Tls.Cert
	key := server.Config.Tls.Key

	if cert == "" && key == "" {
		return server.instance.ListenAndServe()
	}

	if cert == "" {
		return fmt.Errorf("TLS certificate path is not configured")
	}

	if key == "" {
		return fmt.Errorf("TLS private key path is not configured")
	}

	return server.instance.ListenAndServeTLS(cert, key)
}

func (server *Server) Stop() error {
	if server.instance == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return server.instance.Shutdown(ctx)
}
