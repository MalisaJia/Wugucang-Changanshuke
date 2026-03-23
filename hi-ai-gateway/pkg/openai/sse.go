package openai

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

const (
	SSEDataPrefix = "data: "
	SSEDone       = "[DONE]"
)

// SSEWriter writes Server-Sent Events to an io.Writer.
type SSEWriter struct {
	w io.Writer
}

// NewSSEWriter creates a new SSE writer.
func NewSSEWriter(w io.Writer) *SSEWriter {
	return &SSEWriter{w: w}
}

// WriteEvent writes a single SSE event with JSON-encoded data.
func (sw *SSEWriter) WriteEvent(data interface{}) error {
	b, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal SSE data: %w", err)
	}
	_, err = fmt.Fprintf(sw.w, "%s%s\n\n", SSEDataPrefix, string(b))
	return err
}

// WriteDone writes the [DONE] terminator event.
func (sw *SSEWriter) WriteDone() error {
	_, err := fmt.Fprintf(sw.w, "%s%s\n\n", SSEDataPrefix, SSEDone)
	return err
}

// SSEReader reads Server-Sent Events from an io.Reader.
type SSEReader struct {
	scanner *bufio.Scanner
}

// NewSSEReader creates a new SSE reader.
func NewSSEReader(r io.Reader) *SSEReader {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 64*1024)
	return &SSEReader{scanner: scanner}
}

// ReadEvent reads the next SSE event and returns the raw JSON data.
// Returns io.EOF when the [DONE] event is received or the stream ends.
func (sr *SSEReader) ReadEvent() ([]byte, error) {
	for sr.scanner.Scan() {
		line := sr.scanner.Text()

		// Skip empty lines (event boundaries)
		if line == "" {
			continue
		}

		// Check for data lines
		if !strings.HasPrefix(line, SSEDataPrefix) {
			continue
		}

		data := strings.TrimPrefix(line, SSEDataPrefix)
		data = strings.TrimSpace(data)

		// Check for [DONE] signal
		if data == SSEDone {
			return nil, io.EOF
		}

		return []byte(data), nil
	}

	if err := sr.scanner.Err(); err != nil {
		return nil, fmt.Errorf("SSE scanner: %w", err)
	}

	return nil, io.EOF
}

// ParseChunk parses raw SSE data into a ChatCompletionChunk.
func ParseChunk(data []byte) (*ChatCompletionChunk, error) {
	chunk := &ChatCompletionChunk{}
	if err := json.Unmarshal(data, chunk); err != nil {
		return nil, fmt.Errorf("unmarshal chunk: %w", err)
	}
	return chunk, nil
}

// FormatSSE formats a ChatCompletionChunk as an SSE data line.
func FormatSSE(chunk *ChatCompletionChunk) ([]byte, error) {
	b, err := json.Marshal(chunk)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	buf.WriteString(SSEDataPrefix)
	buf.Write(b)
	buf.WriteString("\n\n")
	return buf.Bytes(), nil
}
