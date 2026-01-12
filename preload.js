const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  getPatients: () => ipcRenderer.invoke('get-patients'),
  addPatient: (data) => ipcRenderer.invoke('add-patient', data),
  getPatientByMRN: (mrn) => ipcRenderer.invoke("get-patient-by-mrn", mrn),
  getPatientById: (id) => ipcRenderer.invoke("get-patient-by-id", id),
  updatePatient: (data) => ipcRenderer.invoke('update-patient', data),

  ensurePatientFolder: (args) => ipcRenderer.invoke("ensure-patient-folder", args),
  saveFileToFolder: (args) => ipcRenderer.invoke("save-file-to-folder", args),
  updatePatientStatus: (args) => ipcRenderer.invoke("update-patient-status", args),
  readFolder: (folderPath) => ipcRenderer.invoke("read-folder", folderPath),
  getReports: () => ipcRenderer.invoke("get-reports"),
  getFolderFiles: (folder) => ipcRenderer.invoke("get-folder-files", folder),
  addProcedure: (procedure) => ipcRenderer.invoke('add-procedure', procedure),
  getProceduresByPatientId: (patient_id) => ipcRenderer.invoke('get-procedures-by-patient-id', patient_id),
  getFullReportData: (id) => ipcRenderer.invoke("get-full-report-data", id),
  updatePatient: data => ipcRenderer.invoke("update-patient-data", data),

  deleteJustProcedure: (patientId) => ipcRenderer.invoke("delete-just-procedure", patientId),
  getProcedureById: (procedureId) => ipcRenderer.invoke("get-procedure-by-id", procedureId),
  deletePatient: (id) => ipcRenderer.invoke("delete-patient", id),
  deleteProcedure: (id) => ipcRenderer.invoke("delete-procedure", id),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  deleteFolder: (abs) => ipcRenderer.invoke("delete-folder", abs),
  getFullPath: (rel) => ipcRenderer.invoke("get-full-path", rel),


  getProceduresByMRN: (mrn) => ipcRenderer.invoke("get-procedures-by-mrn", mrn),
  searchPatients: (query) => ipcRenderer.invoke("search-patients", query),
  deletePatientOrProcedures: (patientId) => ipcRenderer.invoke("delete-patient-or-procedures", patientId),
  saveLogo: (file) => ipcRenderer.invoke("save-logo", file),
  saveSettings: (data) => ipcRenderer.invoke("save-settings", data),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  suggestDoctors: (q) => ipcRenderer.invoke("suggest-doctors", q),
  insertDoctorIfNotExists: (name) => ipcRenderer.invoke("insert-doctor-if-not-exists", name),
  deleteDoctor: (id) => ipcRenderer.invoke("delete-doctor", id),
  suggestExaminations: (q) => ipcRenderer.invoke('suggest-examinations', q),
  insertExaminationIfNotExists: (name) => ipcRenderer.invoke('insert-examination', name),
  deleteExamination: (id) => ipcRenderer.invoke('delete-examination', id),
  checkPdfStatus: (rowData) => ipcRenderer.invoke('check-pdf-status', rowData),

  template: `file://${path.join(__dirname, "template.js").replace(/\\/g, "/")}`,
  getReportPatient: (mrn) => ipcRenderer.invoke("get-report-patient", mrn),

  loadHTML: (relativePath) => {
    const fullPath = path.join(__dirname, relativePath);
    return fs.readFileSync(fullPath, 'utf8');
  },

  loadAsset: (relativePath) => {
    return `file://${path.join(__dirname, relativePath).replace(/\\/g, '/')}`;
  }

});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload loaded');

});

