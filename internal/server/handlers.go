package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

var barcodeRe *regexp.Regexp

func (s *Server) initValidation() {
	barcodeRe = regexp.MustCompile(s.cfg.BarcodePattern)
}

// Jobs

func (s *Server) handleListJobs(w http.ResponseWriter, r *http.Request) {
	jobs, err := s.store.ListJobs(r.Context())
	if err != nil {
		slog.Error("list jobs", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to list jobs")
		return
	}
	writeJSON(w, http.StatusOK, jobs)
}

func (s *Server) handleCreateJob(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	job, err := s.store.CreateJob(r.Context(), body.Title)
	if err != nil {
		slog.Error("create job", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to create job")
		return
	}
	writeJSON(w, http.StatusCreated, job)
}

func (s *Server) handleGetJob(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return
	}

	job, err := s.store.GetJob(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) handleDeleteJob(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return
	}
	if err := s.store.DeleteJob(r.Context(), id); err != nil {
		slog.Error("delete job", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to delete job")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleAddScan(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return
	}

	var body struct {
		Barcode string `json:"barcode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Barcode == "" {
		writeError(w, http.StatusBadRequest, "barcode is required")
		return
	}

	// Use job-specific patterns if any are set, otherwise fall back to global config.
	valid := false
	regexes, err := s.store.GetJobRegexes(r.Context(), id)
	if err != nil {
		slog.Error("get job regexes", "err", err)
	}
	if len(regexes) > 0 {
		for _, rx := range regexes {
			if re, compErr := regexp.Compile(rx); compErr == nil && re.MatchString(body.Barcode) {
				valid = true
				break
			}
		}
	} else {
		valid = barcodeRe.MatchString(body.Barcode)
	}

	scan, err := s.store.AddScan(r.Context(), id, body.Barcode, valid)
	if err != nil {
		slog.Error("add scan", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to add scan")
		return
	}
	writeJSON(w, http.StatusCreated, scan)
}

func (s *Server) handleDeleteScan(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "scanId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid scan id")
		return
	}
	if err := s.store.DeleteScan(r.Context(), id); err != nil {
		slog.Error("delete scan", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to delete scan")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Patterns

func (s *Server) handleListPatterns(w http.ResponseWriter, r *http.Request) {
	patterns, err := s.store.ListPatterns(r.Context())
	if err != nil {
		slog.Error("list patterns", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to list patterns")
		return
	}
	writeJSON(w, http.StatusOK, patterns)
}

func (s *Server) handleCreatePattern(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name  string `json:"name"`
		Regex string `json:"regex"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" || body.Regex == "" {
		writeError(w, http.StatusBadRequest, "name and regex are required")
		return
	}
	if _, err := regexp.Compile(body.Regex); err != nil {
		writeError(w, http.StatusBadRequest, "invalid regex pattern")
		return
	}

	pattern, err := s.store.CreatePattern(r.Context(), body.Name, body.Regex)
	if err != nil {
		slog.Error("create pattern", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to create pattern")
		return
	}
	writeJSON(w, http.StatusCreated, pattern)
}

func (s *Server) handleDeletePattern(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid pattern id")
		return
	}
	if err := s.store.DeletePattern(r.Context(), id); err != nil {
		slog.Error("delete pattern", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to delete pattern")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Job patterns

func (s *Server) handleAddJobPattern(w http.ResponseWriter, r *http.Request) {
	jobID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return
	}

	var body struct {
		PatternID string `json:"pattern_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PatternID == "" {
		writeError(w, http.StatusBadRequest, "pattern_id is required")
		return
	}
	patternID, err := uuid.Parse(body.PatternID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid pattern id")
		return
	}

	if err := s.store.AddJobPattern(r.Context(), jobID, patternID); err != nil {
		slog.Error("add job pattern", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to add pattern to job")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleRemoveJobPattern(w http.ResponseWriter, r *http.Request) {
	jobID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return
	}
	patternID, err := uuid.Parse(chi.URLParam(r, "patternId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid pattern id")
		return
	}

	if err := s.store.RemoveJobPattern(r.Context(), jobID, patternID); err != nil {
		slog.Error("remove job pattern", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to remove pattern from job")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Helpers

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
