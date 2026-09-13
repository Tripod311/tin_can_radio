package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/SherClockHolmes/webpush-go"
	_ "modernc.org/sqlite"
)

const (
	vapidPath = "vapid.json"
	dbPath    = "data.sqlite"
)

type PushHandles struct {
	Mail       string `json:"mail"`
	PublicKey  string `json:"publicKey"`
	PrivateKey string `json:"privateKey"`

	db *sql.DB
}

func (ph *PushHandles) LoadVAPID() error {
	db, err := openDB(dbPath)
	if err != nil {
		return err
	}
	ph.db = db

	file, err := os.Open(vapidPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			fmt.Println("Generating vapid keys")

			privateKey, publicKey, err := webpush.GenerateVAPIDKeys()
			if err != nil {
				return err
			}

			ph.Mail = "mailto:admin@localhost"
			ph.PrivateKey = privateKey
			ph.PublicKey = publicKey

			bytes, err := json.Marshal(ph)
			if err != nil {
				return err
			}

			err = os.WriteFile(vapidPath, bytes, 0644)
			if err != nil {
				return err
			}

			return nil
		}

		return err
	}

	bytes, err := io.ReadAll(file)
	if err != nil {
		return err
	}

	err = json.Unmarshal(bytes, &ph)
	if err != nil {
		return err
	}

	return nil
}

func openDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	_, err = db.Exec(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            endpoint TEXT PRIMARY KEY,
            p256dh   TEXT NOT NULL,
            auth     TEXT NOT NULL
        )
    `)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("create push_subscriptions table: %w", err)
	}

	return db, nil
}

func (ph *PushHandles) AddSubscription(
	ctx context.Context,
	sub webpush.Subscription,
) error {
	if sub.Endpoint == "" || sub.Keys.P256dh == "" || sub.Keys.Auth == "" {
		return errors.New("incomplete push subscription")
	}

	_, err := ph.db.ExecContext(ctx, `
        INSERT INTO push_subscriptions (endpoint, p256dh, auth)
        VALUES (?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
            p256dh = excluded.p256dh,
            auth = excluded.auth
    `, sub.Endpoint, sub.Keys.P256dh, sub.Keys.Auth)

	return err
}

func (ph *PushHandles) RemoveSubscription(
	ctx context.Context,
	endpoint string,
) error {
	_, err := ph.db.ExecContext(ctx,
		`DELETE FROM push_subscriptions WHERE endpoint = ?`,
		endpoint,
	)
	return err
}

func (ph *PushHandles) SendPush(ctx context.Context, payload []byte) error {
	rows, err := ph.db.QueryContext(ctx,
		`SELECT endpoint, p256dh, auth FROM push_subscriptions`,
	)
	if err != nil {
		return fmt.Errorf("load push subscriptions: %w", err)
	}

	var subscriptions []webpush.Subscription
	for rows.Next() {
		var sub webpush.Subscription
		if err := rows.Scan(
			&sub.Endpoint,
			&sub.Keys.P256dh,
			&sub.Keys.Auth,
		); err != nil {
			rows.Close()
			return fmt.Errorf("read push subscription: %w", err)
		}
		subscriptions = append(subscriptions, sub)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("iterate push subscriptions: %w", err)
	}
	if err := rows.Close(); err != nil {
		return fmt.Errorf("close push subscriptions: %w", err)
	}

	var failures []error

	for i, sub := range subscriptions {
		sendCtx, cancel := context.WithTimeout(ctx, 15*time.Second)

		resp, err := webpush.SendNotificationWithContext(
			sendCtx,
			payload,
			&sub,
			&webpush.Options{
				Subscriber:      "mailto:" + ph.Mail,
				VAPIDPublicKey:  ph.PublicKey,
				VAPIDPrivateKey: ph.PrivateKey,
				TTL:             60,
			},
		)

		if err != nil {
			cancel()
			failures = append(failures,
				fmt.Errorf("send push to subscription %d: %w", i, err))
			continue
		}

		status := resp.StatusCode
		resp.Body.Close()
		cancel()

		switch status {
		case http.StatusNotFound, http.StatusGone:
			_, err := ph.db.ExecContext(ctx, `
                DELETE FROM push_subscriptions
                WHERE endpoint = ? AND p256dh = ? AND auth = ?
            `, sub.Endpoint, sub.Keys.P256dh, sub.Keys.Auth)
			if err != nil {
				failures = append(failures,
					fmt.Errorf("remove expired subscription %d: %w", i, err))
			}

		default:
			if status < 200 || status >= 300 {
				failures = append(failures,
					fmt.Errorf("push service returned %d for subscription %d", status, i))
			}
		}
	}

	return errors.Join(failures...)
}
