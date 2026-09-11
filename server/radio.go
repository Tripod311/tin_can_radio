package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/pion/interceptor"
	"github.com/pion/webrtc/v4"
)

type ICEServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

type Radio struct {
	mutex sync.RWMutex

	config      webrtc.Configuration
	mediaEngine *webrtc.MediaEngine
	api         *webrtc.API
	audioTrack  *webrtc.TrackLocalStaticRTP
	listeners   map[*webrtc.PeerConnection]struct{}
	broadcaster *webrtc.PeerConnection
	started     bool

	meta json.RawMessage
}

func NewRadio(servers []ICEServer) (*Radio, error) {
	mediaEngine := &webrtc.MediaEngine{}

	opusCodec := webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:     webrtc.MimeTypeOpus,
			ClockRate:    48000,
			Channels:     2,
			SDPFmtpLine:  "minptime=10;useinbandfec=1",
			RTCPFeedback: nil,
		},
		PayloadType: 111,
	}

	if err := mediaEngine.RegisterCodec(
		opusCodec,
		webrtc.RTPCodecTypeAudio,
	); err != nil {
		return nil, err
	}

	interceptorRegistry := &interceptor.Registry{}

	if err := webrtc.RegisterDefaultInterceptors(
		mediaEngine,
		interceptorRegistry,
	); err != nil {
		return nil, err
	}

	api := webrtc.NewAPI(
		webrtc.WithMediaEngine(mediaEngine),
		webrtc.WithInterceptorRegistry(interceptorRegistry),
	)

	iceServers := make([]webrtc.ICEServer, len(servers))

	for i, server := range servers {
		iceServers[i] = webrtc.ICEServer{
			URLs:       server.URLs,
			Username:   server.Username,
			Credential: server.Credential,
		}
	}

	audioTrack, err := webrtc.NewTrackLocalStaticRTP(
		opusCodec.RTPCodecCapability,
		"audio",
		"tin-can",
	)
	if err != nil {
		return nil, err
	}

	return &Radio{
		config: webrtc.Configuration{
			ICEServers: iceServers,
		},
		mediaEngine: mediaEngine,
		api:         api,
		audioTrack:  audioTrack,
		listeners:   make(map[*webrtc.PeerConnection]struct{}),
		started:     false,
	}, nil
}

func (radio *Radio) Start() {
	radio.mutex.Lock()
	defer radio.mutex.Unlock()

	if radio.started {
		return
	}

	radio.started = true
}

func (radio *Radio) Stop() {
	radio.mutex.Lock()

	if !radio.started {
		radio.mutex.Unlock()
		return
	}

	radio.started = false

	broadcaster := radio.broadcaster
	radio.broadcaster = nil

	listeners := make([]*webrtc.PeerConnection, 0, len(radio.listeners))

	for peerConnection := range radio.listeners {
		listeners = append(listeners, peerConnection)
	}

	radio.listeners = make(map[*webrtc.PeerConnection]struct{})

	radio.mutex.Unlock()

	if broadcaster != nil {
		_ = broadcaster.Close()
	}

	for _, peerConnection := range listeners {
		_ = peerConnection.Close()
	}
}

func (radio *Radio) ReceiveListenOffer(
	offer webrtc.SessionDescription,
) (*webrtc.SessionDescription, error) {
	peerConnection, err := radio.api.NewPeerConnection(radio.config)
	if err != nil {
		return nil, fmt.Errorf("create peer connection: %w", err)
	}

	radio.mutex.Lock()

	if !radio.started {
		radio.mutex.Unlock()
		_ = peerConnection.Close()

		return nil, errors.New("radio is not started")
	}

	radio.listeners[peerConnection] = struct{}{}
	radio.mutex.Unlock()

	closeOnError := func(err error) (*webrtc.SessionDescription, error) {
		radio.removeListener(peerConnection)
		_ = peerConnection.Close()

		return nil, err
	}

	peerConnection.OnConnectionStateChange(
		func(state webrtc.PeerConnectionState) {
			switch state {
			case webrtc.PeerConnectionStateFailed:
				radio.removeListener(peerConnection)
				_ = peerConnection.Close()

			case webrtc.PeerConnectionStateClosed:
				radio.removeListener(peerConnection)
			}
		},
	)

	sender, err := peerConnection.AddTrack(radio.audioTrack)
	if err != nil {
		return closeOnError(fmt.Errorf("add audio track: %w", err))
	}

	// read rtcp packets
	go func() {
		for {
			_, _, err := sender.ReadRTCP()
			if err != nil {
				return
			}
		}
	}()

	if err := peerConnection.SetRemoteDescription(offer); err != nil {
		return closeOnError(
			fmt.Errorf("set remote description: %w", err),
		)
	}

	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		return closeOnError(fmt.Errorf("create answer: %w", err))
	}

	gatherComplete := webrtc.GatheringCompletePromise(peerConnection)

	if err := peerConnection.SetLocalDescription(answer); err != nil {
		return closeOnError(
			fmt.Errorf("set local description: %w", err),
		)
	}

	<-gatherComplete

	localDescription := peerConnection.LocalDescription()
	if localDescription == nil {
		return closeOnError(errors.New("local description is missing"))
	}

	return localDescription, nil
}

func (radio *Radio) removeListener(
	peerConnection *webrtc.PeerConnection,
) {
	radio.mutex.Lock()
	delete(radio.listeners, peerConnection)
	radio.mutex.Unlock()
}

func (radio *Radio) ReceiveBroadcastOffer(
	offer webrtc.SessionDescription,
) (*webrtc.SessionDescription, error) {
	peerConnection, err := radio.api.NewPeerConnection(radio.config)
	if err != nil {
		return nil, fmt.Errorf("create peer connection: %w", err)
	}

	radio.mutex.Lock()

	if !radio.started {
		radio.mutex.Unlock()
		_ = peerConnection.Close()

		return nil, errors.New("radio is not started")
	}

	if radio.broadcaster != nil {
		radio.mutex.Unlock()
		_ = peerConnection.Close()

		return nil, errors.New("broadcaster is already connected")
	}

	radio.broadcaster = peerConnection
	radio.mutex.Unlock()

	closeOnError := func(err error) (*webrtc.SessionDescription, error) {
		radio.removeBroadcaster(peerConnection)
		_ = peerConnection.Close()

		return nil, err
	}

	peerConnection.OnConnectionStateChange(
		func(state webrtc.PeerConnectionState) {
			switch state {
			case webrtc.PeerConnectionStateFailed:
				radio.removeBroadcaster(peerConnection)
				_ = peerConnection.Close()

			case webrtc.PeerConnectionStateClosed:
				radio.removeBroadcaster(peerConnection)
			}
		},
	)

	peerConnection.OnTrack(func(
		remoteTrack *webrtc.TrackRemote,
		_ *webrtc.RTPReceiver,
	) {
		if remoteTrack.Kind() != webrtc.RTPCodecTypeAudio {
			return
		}

		codec := remoteTrack.Codec()

		fmt.Printf(
			"broadcast track received: mime=%s, pt=%d, clock=%d, channels=%d\n",
			codec.MimeType,
			codec.PayloadType,
			codec.ClockRate,
			codec.Channels,
		)

		if codec.MimeType != webrtc.MimeTypeOpus {
			fmt.Printf("unsupported broadcast codec: %s\n", codec.MimeType)
			_ = peerConnection.Close()
			return
		}

		go func() {
			firstPacket := true

			for {
				packet, _, err := remoteTrack.ReadRTP()
				if err != nil {
					fmt.Printf("broadcast RTP read stopped: %v\n", err)
					return
				}

				if firstPacket {
					fmt.Printf(
						"first broadcast RTP packet: pt=%d, seq=%d, timestamp=%d\n",
						packet.PayloadType,
						packet.SequenceNumber,
						packet.Timestamp,
					)

					firstPacket = false
				}

				packet.Extension = false
				packet.Extensions = nil

				if err := radio.audioTrack.WriteRTP(packet); err != nil {
					fmt.Printf("broadcast RTP write error: %v\n", err)
				}
			}
		}()
	})

	if err := peerConnection.SetRemoteDescription(offer); err != nil {
		return closeOnError(
			fmt.Errorf("set remote description: %w", err),
		)
	}

	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		return closeOnError(fmt.Errorf("create answer: %w", err))
	}

	gatherComplete := webrtc.GatheringCompletePromise(peerConnection)

	if err := peerConnection.SetLocalDescription(answer); err != nil {
		return closeOnError(
			fmt.Errorf("set local description: %w", err),
		)
	}

	<-gatherComplete

	localDescription := peerConnection.LocalDescription()
	if localDescription == nil {
		return closeOnError(errors.New("local description is missing"))
	}

	return localDescription, nil
}

func (radio *Radio) removeBroadcaster(
	peerConnection *webrtc.PeerConnection,
) {
	radio.mutex.Lock()
	defer radio.mutex.Unlock()

	if radio.broadcaster == peerConnection {
		radio.broadcaster = nil
		radio.meta = nil
	}
}

func (radio *Radio) GetStatus() (bool, int) {
	radio.mutex.RLock()
	defer radio.mutex.RUnlock()

	return radio.broadcaster != nil, len(radio.listeners)
}
