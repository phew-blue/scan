package server

import "testing"

func TestValidateBarcode(t *testing.T) {
	tests := []struct {
		name     string
		barcode  string
		patterns []string
		want     bool
	}{
		{
			name:     "matches single pattern",
			barcode:  "TL12345678",
			patterns: []string{`^TL\d{8}$`},
			want:     true,
		},
		{
			name:     "matches second of two patterns",
			barcode:  "TL123456",
			patterns: []string{`^TL\d{8}$`, `^TL\d{6}$`},
			want:     true,
		},
		{
			name:     "matches none",
			barcode:  "INVALID",
			patterns: []string{`^TL\d{8}$`},
			want:     false,
		},
		{
			name:     "no patterns → valid",
			barcode:  "anything",
			patterns: []string{},
			want:     true,
		},
		{
			name:     "nil patterns → valid",
			barcode:  "anything",
			patterns: nil,
			want:     true,
		},
		{
			name:     "invalid regex is skipped, valid pattern still matches",
			barcode:  "TL12345678",
			patterns: []string{`[invalid`, `^TL\d{8}$`},
			want:     true,
		},
		{
			name:     "invalid regex is skipped, no valid pattern",
			barcode:  "TL12345678",
			patterns: []string{`[invalid`},
			want:     false,
		},
		{
			name:     "partial match rejected",
			barcode:  "TL123456789",
			patterns: []string{`^TL\d{8}$`},
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := validateBarcode(tt.barcode, tt.patterns)
			if got != tt.want {
				t.Errorf("validateBarcode(%q, %v) = %v, want %v", tt.barcode, tt.patterns, got, tt.want)
			}
		})
	}
}
