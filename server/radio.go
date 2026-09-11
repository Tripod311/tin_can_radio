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

	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
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
		webrtc.RTPCodecCapability{
			MimeType: webrtc.MimeTypeOpus,
		},
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
	radio.mutex.Lock()

	if !radio.started {
		radio.mutex.Unlock()
		return nil, errors.New("radio is not started")
	}

	peerConnection, err := radio.api.NewPeerConnection(radio.config)
	if err != nil {
		return nil, fmt.Errorf("create peer connection: %w", err)
	}

	radio.listeners[peerConnection] = struct{}{}
	radio.mutex.Unlock()

	closeOnError := func(err error) (*webrtc.SessionDescription, error) {
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
	radio.mutex.RLock()
	started := radio.started
	radio.mutex.RUnlock()

	if !started {
		return nil, errors.New("radio is not started")
	}

	peerConnection, err := radio.api.NewPeerConnection(radio.config)
	if err != nil {
		return nil, fmt.Errorf("create peer connection: %w", err)
	}

	radio.mutex.Lock()

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

		go func() {
			for {
				packet, _, err := remoteTrack.ReadRTP()
				if err != nil {
					return
				}

				if err := radio.audioTrack.WriteRTP(packet); err != nil {
					return
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
	return radio.broadcaster != nil, len(radio.listeners)
}

func (radio *Radio) GetMeta() json.RawMessage {
	return radio.meta
}

func (radio *Radio) SetMeta(meta json.RawMessage) {
	radio.meta = meta
}
