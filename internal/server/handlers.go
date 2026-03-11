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
		slog.Error("get job", "err", err)
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
	jobID, err := uuid.Parse(chi.URLParam(r, "id"))
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

	valid := barcodeRe.MatchString(body.Barcode)

	sc, err := s.store.AddScan(r.Context(), jobID, body.Barcode, valid)
	if err != nil {
		slog.Error("add scan", "err", err)
		writeError(w, http.StatusInternalServerError, "failed to add scan")
		return
	}
	writeJSON(w, http.StatusCreated, sc)
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
