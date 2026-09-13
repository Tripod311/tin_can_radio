package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/pion/webrtc/v4"
)

type StatusResponse struct {
	Broadcasting bool `json:"broadcasting"`
	Listeners    int  `json:"listeners"`
}

type Radio interface {
	GetStatus() (bool, int)
	ReceiveListenOffer(offer webrtc.SessionDescription) (*webrtc.SessionDescription, error)
	ReceiveBroadcastOffer(offer webrtc.SessionDescription) (*webrtc.SessionDescription, error)
	SetBroadcastHandle(handle func(bool))
}

type API struct {
	Title       string
	Description string
	Password    string
	Session     *Session
	Radio       Radio
	PushHandles *PushHandles
}

func NewAPI(title string, description string, password string) (*API, error) {
	result := API{
		Title:       title,
		Description: description,
		Password:    password,
		Session:     NewSession(),
		PushHandles: &PushHandles{},
	}

	err := result.PushHandles.LoadVAPID()
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func (api *API) Register(mux *http.ServeMux) {
	api.Radio.SetBroadcastHandle(api.OnStationStatusChange)

	mux.HandleFunc("/api/logo", api.HandleLogo)
	mux.HandleFunc("/api/description", api.HandleDescription)
	mux.HandleFunc("/api/status", api.HandleStatus)
	mux.HandleFunc("/api/listen", api.HandleListen)

	mux.HandleFunc("/api/enterStudio", api.HandleEnter)
	mux.HandleFunc("/api/refreshStudio", api.HandleRefresh)
	mux.HandleFunc("/api/broadcast", api.HandleBroadcast)
	mux.HandleFunc("/api/leaveStudio", api.HandleLeave)

	mux.HandleFunc("/api/push/vapid", api.GetVapid)
	mux.HandleFunc("/api/push/subscribe", api.PushSubscribe)
	mux.HandleFunc("/api/push/unsubscribe", api.PushUnsubscribe)
}

func (api *API) Shutdown() {
	api.Session.Shutdown()
}

func (api *API) HandleDescription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body := map[string]string{
		"title":       api.Title,
		"description": api.Description,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(body); err != nil {
		fmt.Printf("description encode error: %s", err)
	}
}

func (api *API) HandleEnter(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "error on read", http.StatusInternalServerError)
		return
	}

	pwd := string(bytes)
	if pwd != api.Password {
		http.Error(w, "invalid key", http.StatusLocked)
		return
	}

	token, err := api.Session.Acquire()
	if err != nil {
		http.Error(w, "studio is occupied", http.StatusLocked)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "studio_session",
		Value:    token,
		Path:     "/",
		MaxAge:   24 * 60 * 60,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})

	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)

	w.Write([]byte("OK"))

}

func (api *API) HandleRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token, err := r.Cookie("studio_session")
	if err != nil {
		http.Error(w, "session expired", http.StatusInternalServerError)
		return
	}

	err = api.Session.Refresh(token.Value)
	if err != nil {
		http.Error(w, "invalid token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)

	w.Write([]byte("OK"))
}

func (api *API) HandleLeave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token, err := r.Cookie("studio_session")
	if err != nil {
		http.Error(w, "session expired", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "studio_session",
		Value:    "",
		Path:     "/",
		MaxAge:   0,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})

	err = api.Session.Release(token.Value)
	if err != nil {
		http.Error(w, "invalid token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)

	w.Write([]byte("OK"))
}

func (api *API) HandleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if api.Radio == nil {
		http.Error(w, "radio is not set", http.StatusNotFound)
		return
	}

	res := StatusResponse{}
	broadcasting, listeners := api.Radio.GetStatus()
	res.Broadcasting = broadcasting
	res.Listeners = listeners

	bytes, err := json.Marshal(res)
	if err != nil {
		http.Error(w, "serialization error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	w.Write(bytes)
}

func (api *API) HandleListen(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read request body", http.StatusBadRequest)
		return
	}

	var offer webrtc.SessionDescription

	if err := json.Unmarshal(body, &offer); err != nil {
		http.Error(w, "invalid SDP offer", http.StatusBadRequest)
		return
	}

	if offer.Type != webrtc.SDPTypeOffer {
		http.Error(w, "expected SDP offer", http.StatusBadRequest)
		return
	}

	answer, err := api.Radio.ReceiveListenOffer(offer)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(answer); err != nil {
		return
	}
}

func (api *API) HandleBroadcast(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token, err := r.Cookie("studio_session")
	if err != nil {
		http.Error(w, "session expired", http.StatusInternalServerError)
		return
	}

	err = api.Session.Refresh(token.Value)
	if err != nil {
		http.Error(w, "session expired", http.StatusLocked)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read request body", http.StatusBadRequest)
		return
	}

	var offer webrtc.SessionDescription

	if err := json.Unmarshal(body, &offer); err != nil {
		http.Error(w, "invalid SDP offer", http.StatusBadRequest)
		return
	}

	if offer.Type != webrtc.SDPTypeOffer {
		http.Error(w, "expected SDP offer", http.StatusBadRequest)
		return
	}

	answer, err := api.Radio.ReceiveBroadcastOffer(offer)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(answer); err != nil {
		return
	}
}

func (api *API) HandleLogo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	executablePath, err := os.Executable()
	if err != nil {
		http.Error(w, "failed to locate executable", http.StatusInternalServerError)
		return
	}

	executableDir := filepath.Dir(executablePath)

	entries, err := os.ReadDir(executableDir)
	if err != nil {
		http.Error(w, "failed to read executable directory", http.StatusInternalServerError)
		return
	}

	for _, entry := range entries {
		name := entry.Name()

		if name != "logo" && !strings.HasPrefix(name, "logo.") {
			continue
		}

		info, err := entry.Info()
		if err != nil || !info.Mode().IsRegular() {
			continue
		}

		http.ServeFile(
			w,
			r,
			filepath.Join(executableDir, name),
		)

		return
	}

	http.NotFound(w, r)
}

func (api *API) GetVapid(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(api.PushHandles.PublicKey))
}

func (api *API) PushSubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 16<<10))
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var sub webpush.Subscription
	if err := json.Unmarshal(body, &sub); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if sub.Endpoint == "" || sub.Keys.P256dh == "" || sub.Keys.Auth == "" {
		http.Error(w, "incomplete subscription", http.StatusBadRequest)
		return
	}

	if err := api.PushHandles.AddSubscription(r.Context(), sub); err != nil {
		http.Error(w, "could not save subscription", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (api *API) PushUnsubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 16<<10))
	if err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var req struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if req.Endpoint == "" {
		http.Error(w, "endpoint is required", http.StatusBadRequest)
		return
	}

	if err := api.PushHandles.RemoveSubscription(r.Context(), req.Endpoint); err != nil {
		http.Error(w, "could not remove subscription", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (api *API) OnStationStatusChange(status bool) {
	if status {
		ctx := context.WithoutCancel(context.Background())
		message := fmt.Sprintf("%s started broadcast", api.Title)
		api.PushHandles.SendPush(ctx, []byte(message))
	} else {
		ctx := context.WithoutCancel(context.Background())
		message := fmt.Sprintf("%s stopped broadcast", api.Title)
		api.PushHandles.SendPush(ctx, []byte(message))
	}
}
