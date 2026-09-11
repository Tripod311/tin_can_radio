package api

import (
	"crypto/rand"
	"fmt"
	"time"
)

const sessionStaleTime = 60 * time.Second

type SessionCommand struct {
	Command  string
	Token    string
	Response chan SessionResponse
}

type SessionResponse struct {
	Token string
	Error error
}

type Session struct {
	queue    chan SessionCommand
	shutdown chan struct{}
}

func NewSession() *Session {
	result := Session{
		shutdown: make(chan struct{}),
		queue:    make(chan SessionCommand),
	}

	go result.listen()

	return &result
}

func (session *Session) Acquire() (string, error) {
	resChan := make(chan SessionResponse)
	command := SessionCommand{
		Command:  "acquire",
		Response: resChan,
	}

	session.queue <- command
	res := <-resChan

	if res.Error != nil {
		return "", res.Error
	} else {
		return res.Token, nil
	}
}

func (session *Session) Release(token string) error {
	resChan := make(chan SessionResponse)
	command := SessionCommand{
		Command:  "release",
		Token:    token,
		Response: resChan,
	}

	session.queue <- command
	res := <-resChan

	return res.Error
}

func (session *Session) Refresh(token string) error {
	resChan := make(chan SessionResponse)
	command := SessionCommand{
		Command:  "refresh",
		Token:    token,
		Response: resChan,
	}

	session.queue <- command
	res := <-resChan

	return res.Error
}

func (session *Session) listen() {
	var occupied bool
	var token string
	var timer *time.Timer
	var timerChannel <-chan time.Time

	clear := func() {
		if timer != nil {
			timer.Stop()
		}
		timerChannel = nil
		timer = nil
		token = ""
		occupied = false
	}

	for {
		select {
		case command := <-session.queue:
			switch command.Command {
			case "acquire":
				if occupied {
					command.Response <- SessionResponse{
						Error: fmt.Errorf("studio is occupied"),
					}
					continue
				}

				occupied = true
				token = rand.Text()
				timer = time.NewTimer(sessionStaleTime)
				timerChannel = timer.C

				command.Response <- SessionResponse{
					Token: token,
				}
				fmt.Println("Studio occupied")
			case "release":
				if !occupied {
					command.Response <- SessionResponse{
						Error: fmt.Errorf("studio is free"),
					}
					continue
				}

				if command.Token != token {
					command.Response <- SessionResponse{
						Error: fmt.Errorf("invalid token"),
					}
					continue
				}

				clear()
				command.Response <- SessionResponse{}
				fmt.Println("Studio released")
			case "refresh":
				if !occupied {
					command.Response <- SessionResponse{
						Error: fmt.Errorf("studio is free"),
					}
					continue
				}

				if command.Token != token {
					command.Response <- SessionResponse{
						Error: fmt.Errorf("invalid token"),
					}
					continue
				}

				timer.Reset(sessionStaleTime)
				command.Response <- SessionResponse{}
			default:
				command.Response <- SessionResponse{
					Error: fmt.Errorf("unknown command %s", command.Command),
				}
			}
		case <-timerChannel:
			clear()
		case <-session.shutdown:
			return
		}
	}
}

func (session *Session) Shutdown() {
	close(session.shutdown)
}
