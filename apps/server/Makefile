.PHONY: test lint build

test:
	go test ./...

lint:
	go vet ./...

build:
	go build -o ../../dist/server ./cmd/api
