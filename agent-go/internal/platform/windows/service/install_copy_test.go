package service

import "testing"

func TestStripConfigTrailer(t *testing.T) {
	body := "MZ-binary"
	withCfg := body + "\n<<INV_CONFIG>>{\"a\":1}<<INV_CONFIG>>\n"
	if got := string(stripConfigTrailer([]byte(withCfg))); got != body {
		t.Errorf("got %q, want %q", got, body)
	}
	if got := string(stripConfigTrailer([]byte(body))); got != body {
		t.Errorf("sem trailer: got %q", got)
	}
}
