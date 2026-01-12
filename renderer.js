let sessionFolderPath = null;
let currentSession = null;
let mediaRecorder;
let recordedChunks = [];
let lastRecordedFilePath = null;
let procedureStarted = false;
let procedureLocked = false;
let selectedPatient = null;
let selectedProcedure = null;

let currentLightboxIndex = 0;
let currentLightboxFiles = [];

let allReports = [];

let everyReports = [];
let currentPage = 1;
const pageSize = 10;

// 🔍 Fungsi global untuk mengetahui tab yang sedang aktif
window.getActiveTab = function () {
  const active = document.querySelector(".nav-link.active, .tab-button.active");
  if (!active) return null;

  // Gunakan data-bs-target (Bootstrap) atau data-tab, tergantung struktur kamu
  const tabId = active.getAttribute("data-bs-target") || active.dataset.tab;
  if (!tabId) return null;

  // Hilangkan tanda '#' di depan ID tab
  return tabId.replace(/^#/, "");
};

async function startProcedureSession(mrn, procedureName, procedureId) {

  currentSession = null;
  sessionFolderPath = null;

  const procedureDate = formatDate(new Date());
  const procedureTime = formatTime(new Date());

  const result = await window.electronAPI.ensurePatientFolder({
    mrn,
    procedure: procedureName,
    // procedureDate,
    // procedureTime,
    procedureId
  });

  // result = { folderPath: "D:/Laparoscopy..." }
  const folderPath = result.folderPath;

  currentSession = folderPath;
  sessionFolderPath = folderPath;

  return folderPath;
}

function toFileUrl(path) {
  return `file:///${path.replace(/\\/g, "/")}`;
}

// Fungsi bantu untuk format tanggal
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatTime(date) {
  const d = new Date(date);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}.${m}`;
}

// Global helper: refresh patients table if it's present in DOM
async function refreshPatientsList() {
  const tableBody = document.querySelector("#patient-table tbody");
  if (!tableBody) return;

  const patients = await window.electronAPI.getPatients();
  tableBody.innerHTML = patients
    .map(
      (p) => `
        <tr data-id="${p.id}">
          <td>${p.mrn}</td>
          <td>${p.name}</td>
          <td>${p.age}</td>
          <td>${p.sex}</td>
          <td>${p.procedure}</td>
          <td>${p.doctor_name}</td>
        </tr>`
    )
    .join("");
}

// Fungsi capture image
async function captureImage(videoElement, patient) {
  // 🔒 Pastikan folder sesi aktif sudah dibuat
  if (!currentSession) {
    console.warn("⚠️ Belum ada sesi aktif, membuat otomatis...");
    await startProcedureSession(patient.mrn, selectedProcedure.procedure_id);

  }

  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0);

  const dataUrl = canvas.toDataURL("image/jpeg");
  const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

  const fileName = `capture_${Date.now()}.jpg`;

  // 💾 Simpan ke folder sesi aktif
  const filePath = await window.electronAPI.saveFileToFolder({
    folderPath: currentSession,
    fileName,
    data: base64Data,
    type: "base64",
  });

  // console.log("✅ Foto disimpan di:", filePath);
  addToGallery(filePath, "image");
}

async function startRecording(stream, patient) {
  // Ensure session folder exists before starting recording to avoid race
  if (!currentSession) {
    console.warn("⚠️ Belum ada sesi aktif, membuat otomatis...");
    // IMPORTANT: wait for folder creation
    await startProcedureSession(patient.mrn, selectedProcedure.procedure_id);
  }

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    recordedChunks = [];

    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const folderPath = currentSession;
    const fileName = `record_${Date.now()}.webm`;
    const filePath = `${folderPath}\\${fileName}`;

    await window.electronAPI.saveFileToFolder({
      folderPath,
      fileName,
      // data: Array.from(uint8Array),
      data: uint8Array,
      type: "uint8",
    });

    // console.log(`✅ Video disimpan di: ${filePath}`);
    lastRecordedFilePath = filePath;
  };

  mediaRecorder.start();
}

async function stopRecording(patient) {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    // console.log("⏹️ Menghentikan rekaman...");
    mediaRecorder.stop();

    // Tunggu agar onstop selesai
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // ✅ Pakai path dari onstop
    if (lastRecordedFilePath) {
      addToGallery(lastRecordedFilePath, "video");
      lastRecordedFilePath = null; // reset setelah ditampilkan
    } else {
      console.warn("⚠️ Tidak ada video yang direkam.");
    }
  }
}

function addToGallery(filePath, type) {
  const galleryContainer = document.getElementById("gallery-container");
  if (!galleryContainer) {
    console.error("❌ gallery-container not found in DOM!");
    return;
  }

  // Pastikan path jadi format URL yang valid
  const fileUrl = `file:///${filePath.replace(/\\/g, "/")}`; // <-- penting: ubah \ jadi /

  const item = document.createElement("div");
  item.classList.add("photo-item", "rounded", "overflow-hidden", "position-relative");
  item.style.height = "160px";
  item.style.cursor = "pointer";
  item.style.border = "2px solid #ddd";

  if (type === "image") {
    item.innerHTML = `<img src="${fileUrl}" class="w-100 h-100 object-fit-cover" alt="capture">`;
  } else if (type === "video") {
    item.innerHTML = `
      <video class="w-100 h-100 object-fit-cover" muted preload="metadata">
        <source src="${fileUrl}" type="video/webm">
        Browser Anda tidak mendukung video tag.
      </video>
      <div class="position-absolute top-50 start-50 translate-middle text-white fs-1 opacity-75">🎥</div>`;
  }

  // Klik → tampilkan di modal
  item.addEventListener("click", () => {
    const modalEl = document.getElementById("mediaPreviewModal");
    const modalBody = document.getElementById("modal-media-preview");

    if (type === "image") {
      modalBody.innerHTML = `<img src="${fileUrl}" class="w-100 rounded">`;
    } else {
      modalBody.innerHTML = `
        <video id="preview-video" class="w-100 rounded" controls autoplay muted>
          <source src="${fileUrl}" type="video/webm">
          Browser Anda tidak mendukung video tag.
        </video>`;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    modalEl.addEventListener(
      "shown.bs.modal",
      () => {
        const vid = document.getElementById("preview-video");
        if (vid) {
          vid.load(); // muat ulang source dengan path baru
          vid.play().catch((err) => console.warn("🎬 Autoplay gagal:", err));
        }
      },
      { once: true }
    );
  });

  galleryContainer.prepend(item);
}

async function checkStorage() {
  const usage = await window.electronAPI.invoke("get-disk-usage");

  const freeGB = usage.free / 1024 / 1024 / 1024;

  // simpan global untuk page lain
  window.diskUsage = { freeGB };

  const diskEl = document.querySelector("#disk-usage");

  if (!diskEl) {
    console.warn("⚠ #disk-usage belum ada, skip update");
    return;
  }

  diskEl.textContent = `Free disk: ${freeGB.toFixed(1)} GB`;

  // warnai otomatis
  if (freeGB < 5) {
    diskEl.classList.remove("text-warning", "text-success");
    diskEl.classList.add("text-danger");
  } else if (freeGB < 15) {
    diskEl.classList.remove("text-danger", "text-success");
    diskEl.classList.add("text-warning");
  } else {
    diskEl.classList.remove("text-danger", "text-warning");
    diskEl.classList.add("text-success");
  }
}

function renderReportsRows(rows) {
  const tableBody = document.querySelector("#reports-table tbody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;

  const pageRows = rows.slice(start, end);

  pageRows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.mrnName}</td>
      <td>${r.procedure}</td>
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td class="text-start">
        ${r.hasPdf
        ? `<span class="pdf-view" 
           data-folder="${r.folderPath}" 
           data-id="${r.id}"
           style="color:green; font-size:1.4em; cursor:pointer;" 
           title="Buka PDF">✓</span>`
        : `<span class="pdf-create"
                    data-folder="${r.folderPath}"
                    data-id="${r.id}"
                    style="color:red;font-size:1.4em; cursor:pointer;">⚠</span>`
      }
      </td>
      <td class="text-start">
        <button class="btn btn-sm btn-secondary btn-open" data-folder="${r.folderPath}">⋮</button>
      </td>
      <td>
        <button class="btn btn-sm btn-warning btn-edit" data-folder="${r.folderPath}" data-id="${r.id}">Edit</button>
      </td>
      <td>
        <button class="btn btn-sm btn-danger btn-delete" data-folder="${r.folderPath}" data-id="${r.id}">Delete</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  renderPagination(rows.length);
}

function renderPagination(totalRows) {
  const totalPages = Math.ceil(totalRows / pageSize);
  console.log("total pages:", totalPages);

  const pagination = document.querySelector("#reports-pagination ul");
  if (!pagination) return;

  pagination.innerHTML = "";

  // Prev button
  pagination.innerHTML += `
    <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
      <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
    </li>
  `;

  // Number buttons
  for (let i = 1; i <= totalPages; i++) {
    pagination.innerHTML += `
      <li class="page-item ${i === currentPage ? "active" : ""}">
        <a class="page-link" href="#" data-page="${i}">${i}</a>
      </li>
    `;
  }

  // Next button
  pagination.innerHTML += `
    <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
      <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
    </li>
  `;
}

document.addEventListener("click", async (e) => {

  const recreateBtn = e.target.closest(".pdf-view");
  if (recreateBtn) {
    const { isConfirmed } = await Swal.fire({
      title: 'Re-Create Report?',
      text: "The PDF report already exists. Do you want to edit and overwrite the old file?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Edit Again',
      cancelButtonText: 'Cancel'
    });

    if (isConfirmed) {
      await openCreateReportPage(
        recreateBtn.dataset.folder,
        recreateBtn.dataset.id
      );
    }
    return;
  }

  const openBtn = e.target.closest(".btn-open");
  if (openBtn) {
    const folder = openBtn.dataset.folder;

    const html = window.electronAPI.loadHTML("views/reports-detail.html");
    document.querySelector("#reports-content").innerHTML = html;

    const files = await window.electronAPI.getFolderFiles(folder);
    renderFolderFiles(files);
    return;
  }

  const pdfBtn = e.target.closest(".pdf-create");
  if (pdfBtn) {
    await openCreateReportPage(
      pdfBtn.dataset.folder,
      pdfBtn.dataset.id
    );
    return;
  }

  const editBtn = e.target.closest(".btn-edit");
  if (editBtn) {
    openEditPage(editBtn.dataset.folder, editBtn.dataset.id);
    return;
  }

  const deleteBtn = e.target.closest(".btn-delete");
  if (deleteBtn) {
    openDeletePage(deleteBtn.dataset.folder, deleteBtn.dataset.id);
    return;
  }

});

async function renderReportsTable() {
  await checkStorage();

  const tableBody = document.querySelector("#reports-table tbody");
  if (!tableBody) return;

  everyReports = await window.electronAPI.getReports();
  currentPage = 1;
  renderReportsRows(everyReports);
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("page-link")) {
    e.preventDefault();

    const page = Number(e.target.dataset.page);
    if (!page) return;

    const totalPages = Math.ceil(everyReports.length / pageSize);

    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderReportsRows(everyReports);
    console.log("📄 Pindah ke halaman:", page);
  }
});

// async function applyKopSettings() {
//   const settings = await window.electronAPI.getSettings(); // ambil file JSON

//   if (!settings) {
//     console.warn("⚠️ Settings kosong / belum diset");
//     return;
//   }

//   // Ambil elemen DOM setelah HTML load
//   const logoEl = document.querySelector("#logo");
//   const instansiEl = document.querySelector(".instansi");
//   const detailEl = document.querySelector(".kop-detail");

//   // Logo
//   if (settings.logoPath && logoEl) {
//     logoEl.src = settings.logoPath;
//   }

//   // Nama RS
//   if (settings.rs && instansiEl) {
//     instansiEl.textContent = settings.rs;
//   }

//   // Detail RS (multi-line)
//   // if (settings.detailRs && detailEl) {
//   //   detailEl.innerHTML = settings.detailRs.replace(/\n/g, "<br>");
//   // }
//   if (settings.detailRs && detailEl) {
//     detailEl.textContent = settings.detailRs;
//   }
//   console.log("🏥 Kop surat diaplikasikan:", settings);
// }

async function applyKopSettings() {
  const settings = await window.electronAPI.getSettings();
  console.log("🔍 Data yang diterima Report:", settings);

  if (!settings) return;

  const logoEl = document.querySelector("#logo");
  const instansiEl = document.querySelector(".instansi");
  const detailEl = document.querySelector(".kop-detail");

  if (settings.logoPath && logoEl) logoEl.src = settings.logoPath;
  if (settings.rs && instansiEl) instansiEl.textContent = settings.rs;

  if (detailEl) {
    const dept = settings.departmentsRs || "";
    const addr = settings.detailRs || "";

    // Split berdasarkan newline dan bersihkan baris kosong
    const deptLines = dept.split('\n').filter(l => l.trim() !== "");

    let htmlContent = "";

    // LOOPING: Semua baris di Departemen (b dan c) diberi class dept-row
    deptLines.forEach(line => {
      htmlContent += `<div class="dept-row">${line.trim()}</div>`;
    });

    // Baris alamat (d) diberi class addr-row
    if (addr) {
      htmlContent += `<div class="addr-row">${addr.trim()}</div>`;
    }

    detailEl.innerHTML = htmlContent;
  }
}

async function openCreateReportPage(folderPath, procedureId) {
  console.log("📂 Membuka create-report.html untuk:", folderPath, "PID:", procedureId);

  window.currentReportFolder = folderPath;
  window.currentProcedureId = procedureId;

  const target = document.querySelector("#reports-content");

  // Load HTML
  const html = window.electronAPI.loadHTML("views/create-report.html");
  target.innerHTML = html;

  await waitForCreateReportElements();

  // 🟦 Tambahkan ini: apply kop header
  await applyKopSettings();

  // Load template.js
  const js = document.createElement("script");
  js.src = window.electronAPI.template;

  js.onload = async () => {
    await waitForCreateReportElements();

    if (window.initTemplate) {
      window.initTemplate();
    }

    await fillPatientInfoFromDatabase(folderPath, procedureId);
  };

  target.appendChild(js);

  // Render foto
  const files = await window.electronAPI.getFolderFiles(folderPath);
  renderReportPhotos(files);
}

// function renderReportPhotos(files) {
//   const list = document.getElementById("patient-photo-list");
//   if (!list) return;

//   list.innerHTML = "";

//   const images = files
//     .filter(f => /\.(jpg|jpeg|png)$/i.test(f.ext))
//     .map(f => f.path.replace(/\\/g, "/"));

//   if (images.length === 0) {
//     list.innerHTML = "<p class='text-muted'>Tidak ada foto</p>";
//     return;
//   }

//   images.forEach(src => {
//     const img = document.createElement("img");
//     img.src = `file:///${src}`;
//     img.className = "thumb-item";

//     // 👇 Klik gambar kiri → masuk ke right-report
//     img.addEventListener("click", () => {
//       const photoArea = document.getElementById("photo-area");
//       if (photoArea.children.length >= 10) return;

//       // Pindah ke kanan
//       const bigImg = document.createElement("img");
//       bigImg.src = img.src;
//       bigImg.className = "thumb-item-big";
//       bigImg.style.width = "100%";
//       bigImg.style.marginBottom = "10px";
//       bigImg.style.objectFit = "contain";
//       bigImg.style.borderRadius = "8px";

//       // Klik foto di kanan -> kembali ke kiri
//       bigImg.addEventListener("click", () => {
//         // Hapus dari area kanan
//         bigImg.remove();

//         // Kembalikan ke list kiri
//         const originalImg = document.createElement("img");
//         originalImg.src = bigImg.src;
//         originalImg.className = "thumb-item";

//         // Pasang event pindah lagi
//         originalImg.addEventListener("click", () => {
//           originalImg.remove();
//           photoArea.appendChild(bigImg);
//         });

//         list.appendChild(originalImg);
//       });

//       // Hapus dari kiri saat pindah
//       img.remove();

//       photoArea.appendChild(bigImg);
//     });

//     list.appendChild(img);
//   });
// }

function renderReportPhotos(files) {
  const list = document.getElementById("patient-photo-list");
  const photoArea = document.getElementById("photo-area");
  if (!list || !photoArea) return;

  list.innerHTML = "";

  const images = files
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f.ext))
    .map(f => f.path.replace(/\\/g, "/"));

  images.forEach(src => {
    const fullSrc = `file:///${src}`;

    // Cek duplikat agar tidak muncul di kiri jika sudah ada di kanan
    const isAlreadyOnPaper = Array.from(photoArea.querySelectorAll("img"))
      .some(img => img.src === fullSrc);
    if (isAlreadyOnPaper) return;

    const img = document.createElement("img");
    img.src = fullSrc;
    img.className = "thumb-item";

    img.addEventListener("click", async () => {
      if (photoArea.children.length >= 10) {
        // Ganti alert dengan Swal
        Swal.fire({
          icon: 'error',
          title: 'Batas Maksimal',
          text: 'Maksimal hanya 10 foto yang dapat dimasukkan ke laporan.',
          timer: 2000,
          showConfirmButton: false
        });
        return;
      }

      const bigImg = document.createElement("img");
      bigImg.src = img.src;
      bigImg.className = "thumb-item-big";
      bigImg.style.width = "100%";
      bigImg.style.marginBottom = "10px";
      bigImg.style.objectFit = "contain";
      bigImg.style.borderRadius = "8px";

      bigImg.addEventListener("click", () => {
        bigImg.remove();
        renderReportPhotos(files); // Re-render daftar kiri
      });

      photoArea.appendChild(bigImg);
      img.remove();
    });

    list.appendChild(img);
  });
}

async function waitForCreateReportElements() {
  return new Promise(resolve => {
    const check = () => {
      const list = document.getElementById("patient-photo-list");
      if (list) resolve();
      else setTimeout(check, 20);
    };
    check();
  });
}

async function fillPatientInfoFromDatabase(folderPath, procedureId) {
  console.log("DEBUG: procedureId diterima:", procedureId);

  const p = await window.electronAPI.getFullReportData(procedureId);
  if (!p) return;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;

    if ("value" in el) {
      // input, textarea, select
      el.value = val ?? "";
    } else {
      // p, div, span, etc.
      el.textContent = val ?? "";
    }
  };

  const formatDateLocal = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  set("patient-mrn", p.mrn);
  set("patient-name", p.name);
  // set("patient-dob", p.date_of_birth);
  set("patient-dob", formatDateLocal(p.date_of_birth));
  set("patient-age", p.age);
  set("patient-sex", p.sex);
  set("patient-procedure", p.procedure);
  set("patient-address", p.address);
  set("patient-city", p.city);
  set("patient-telephone", p.telephone);
  set("patient-referring_doctor", p.referring_doctor);
  set("patient-class", p.class);
  set("patient-bed", p.bed);
  set("patient-complaint", p.complaint);
  set("patient-diagnose", p.diagnose);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";

    const date = new Date(dateStr);

    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();

    return `${dd}-${mm}-${yyyy}`;
  };

  // doctor + date
  document.getElementById("doctor-sign").textContent = p.doctor_name || "";
  // document.getElementById("report-date").textContent = p.date_procedure || new Date().toLocaleDateString();
  document.getElementById("report-date").textContent =
    p.date_procedure
      ? formatDate(p.date_procedure)
      : formatDate(new Date());

  console.log("✅ Data lengkap berhasil loaded");
  console.log("🟦 FILL REPORT, procedureId =", procedureId);

}

function loadView(target, file) {
  const html = window.electronAPI.loadHTML(`views/${file}`);
  document.querySelector(target).innerHTML = html;
}

// Helper: enable or disable settings tab button
function setSettingsTabEnabled(enabled) {
  const settingsTabBtn = document.getElementById("settings-tab");
  if (!settingsTabBtn) return;

  if (enabled) {
    settingsTabBtn.classList.remove("disabled");
    settingsTabBtn.removeAttribute("aria-disabled");
    settingsTabBtn.tabIndex = 0;
  } else {
    settingsTabBtn.classList.add("disabled");
    settingsTabBtn.setAttribute("aria-disabled", "true");
    settingsTabBtn.tabIndex = -1;
  }
}

// Load settings HTML into #settings only when tab is enabled
document.addEventListener("click", (e) => {
  const btn = e.target.closest("#settings-tab");
  if (!btn) return;

  // If disabled, prevent action
  if (btn.classList.contains("disabled") || btn.getAttribute("aria-disabled") === "true") {
    e.preventDefault();
    // Optionally show a toast or ignore silently
    console.log("Settings tab is disabled in this context.");
    return;
  }

  // Enabled: load settings view
  try {
    const html = window.electronAPI.loadHTML("views/settings.html");
    const container = document.querySelector("#settings");
    if (container) container.innerHTML = html;
  } catch (err) {
    console.error("Failed to load settings.html:", err);
  }
});

// function openLightbox(files, startIndex = 0) {
//   currentLightboxFiles = files;
//   currentLightboxIndex = startIndex;

//   const overlay = document.createElement("div");
//   overlay.id = "lightbox-overlay";
//   overlay.style.position = "fixed";
//   overlay.style.top = 0;
//   overlay.style.left = 0;
//   overlay.style.width = "100vw";
//   overlay.style.height = "100vh";
//   overlay.style.backgroundColor = "rgba(0,0,0,0.9)";
//   overlay.style.display = "flex";
//   overlay.style.alignItems = "center";
//   overlay.style.justifyContent = "center";
//   overlay.style.zIndex = 9999;

//   const img = document.createElement("img");
//   img.id = "lightbox-img";
//   img.style.maxWidth = "90%";
//   img.style.maxHeight = "90%";
//   img.style.borderRadius = "6px";
//   overlay.appendChild(img);

//   img.src = `file:///${files[startIndex].path.replace(/\\/g, "/")}`;

//   overlay.addEventListener("click", (e) => {
//     if (e.target === overlay) overlay.remove();
//     window.removeEventListener("keydown", handleLightboxKey);
//   });

//   document.body.appendChild(overlay);

//   function handleLightboxKey(e) {
//     if (e.key === "ArrowRight") {
//       currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxFiles.length;
//       img.src = `file:///${currentLightboxFiles[currentLightboxIndex].path.replace(/\\/g, "/")}`;
//     } else if (e.key === "ArrowLeft") {
//       currentLightboxIndex =
//         (currentLightboxIndex - 1 + currentLightboxFiles.length) % currentLightboxFiles.length;
//       img.src = `file:///${currentLightboxFiles[currentLightboxIndex].path.replace(/\\/g, "/")}`;
//     } else if (e.key === "Escape") {
//       overlay.remove();
//       window.removeEventListener("keydown", handleLightboxKey);
//     }
//   }

//   window.addEventListener("keydown", handleLightboxKey);
// }

function openLightbox(files, startIndex = 0) {
  currentLightboxFiles = files;
  currentLightboxIndex = startIndex;

  const overlay = document.createElement("div");
  overlay.id = "lightbox-overlay";
  // Styling tetap sama
  Object.assign(overlay.style, {
    position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
    backgroundColor: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", zIndex: 9999
  });

  // Container untuk Gambar
  const img = document.createElement("img");
  img.id = "lightbox-img";
  img.style.maxWidth = "85%";
  img.style.maxHeight = "80%";
  img.style.borderRadius = "6px";
  overlay.appendChild(img);

  // --- TAMBAHAN: TOMBOL DOWNLOAD ---
  const btnDownload = document.createElement("a");
  btnDownload.innerHTML = '<i class="bi bi-download"></i> Download';
  // Gunakan class Bootstrap untuk styling cepat
  btnDownload.className = "btn btn-light mt-3";
  overlay.appendChild(btnDownload);

  // Fungsi untuk update konten (Foto & Link Download)
  function updateContent() {
    const filePath = currentLightboxFiles[currentLightboxIndex].path;
    const formattedPath = `file:///${filePath.replace(/\\/g, "/")}`;

    img.src = formattedPath;
    btnDownload.href = formattedPath;
    // Mengambil nama file asli untuk nama file download
    btnDownload.download = filePath.split(/[\\/]/).pop();
  }

  // Jalankan update pertama kali
  updateContent();

  // Event untuk menutup overlay
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
      window.removeEventListener("keydown", handleLightboxKey);
    }
  });

  document.body.appendChild(overlay);

  function handleLightboxKey(e) {
    if (e.key === "ArrowRight") {
      currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxFiles.length;
      updateContent();
    } else if (e.key === "ArrowLeft") {
      currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxFiles.length) % currentLightboxFiles.length;
      updateContent();
    } else if (e.key === "Escape") {
      overlay.remove();
      window.removeEventListener("keydown", handleLightboxKey);
    }
  }

  window.addEventListener("keydown", handleLightboxKey);
}

async function openVideoLightbox(videoFile) {
  const overlay = document.createElement("div");
  overlay.id = "video-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0,0,0,0.95)";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999;

  // Video element
  const video = document.createElement("video");
  video.src = `file:///${videoFile.path.replace(/\\/g, "/")}`;
  video.controls = false; // custom controls
  video.style.maxWidth = "90%";
  video.style.maxHeight = "80%";
  video.style.cursor = 'pointer';
  overlay.appendChild(video);

  // Controls container
  const controls = document.createElement("div");
  controls.style.marginTop = "10px";
  controls.style.display = "flex";
  controls.style.gap = "10px";

  // Play / Pause button
  const playBtn = document.createElement("button");
  playBtn.textContent = "Play";
  playBtn.onclick = () => {
    if (video.paused) video.play();
    else video.pause();
  };

  // Capture frame button
  const captureBtn = document.createElement("button");
  captureBtn.textContent = "Capture Frame";
  captureBtn.onclick = async () => {
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      try { await video.play(); video.pause(); } catch (e) { }
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg");
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const timestamp = Date.now();
    const filename = `capture_${timestamp}.jpg`;

    // Ambil folder dari videoFile.path
    const folderPath = videoFile.path.replace(/\\/g, "/").split("/").slice(0, -1).join("/");

    try {
      await window.electronAPI.saveFileToFolder({
        folderPath,   // kirim folder yang valid
        fileName: filename,
        data: base64Data,
        type: "base64"
      });
      Swal.fire({ icon: 'success', title: 'Frame captured', text: filename, timer: 1200, showConfirmButton: false });
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Save failed', text: err?.message || String(err) });
    }
  };
  // Close overlay
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.onclick = () => overlay.remove();

  controls.appendChild(playBtn);
  controls.appendChild(captureBtn);
  controls.appendChild(closeBtn);
  overlay.appendChild(controls);

  // Timeline
  const timeline = document.createElement('div');
  timeline.style.width = '90%';
  timeline.style.maxWidth = '1100px';
  timeline.style.marginTop = '8px';
  timeline.style.display = 'flex';
  timeline.style.alignItems = 'center';
  timeline.style.gap = '8px';

  const currentTimeLabel = document.createElement('span');
  currentTimeLabel.textContent = '00:00';
  currentTimeLabel.style.color = '#fff';
  currentTimeLabel.style.minWidth = '48px';

  const seek = document.createElement('input');
  seek.type = 'range';
  seek.min = 0;
  seek.max = 1000;
  seek.value = 0;
  seek.style.flex = '1';

  const durationLabel = document.createElement('span');
  durationLabel.textContent = '00:00';
  durationLabel.style.color = '#fff';
  durationLabel.style.minWidth = '48px';

  timeline.appendChild(currentTimeLabel);
  timeline.appendChild(seek);
  timeline.appendChild(durationLabel);
  overlay.appendChild(timeline);

  function formatTimeSec(t) {
    if (!isFinite(t)) return '00:00';
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  video.addEventListener('loadedmetadata', () => {
    durationLabel.textContent = formatTimeSec(video.duration);
    seek.max = Math.floor(video.duration * 1000);
  });

  // Update UI as video plays
  const timeUpdateHandler = () => {
    currentTimeLabel.textContent = formatTimeSec(video.currentTime);
    if (!seek.dragging) seek.value = Math.floor(video.currentTime * 1000);
  };
  video.addEventListener('timeupdate', timeUpdateHandler);

  // Seeking
  let last = 0;
  seek.addEventListener('input', () => {
    const now = performance.now();

    if (now - last < 30) return; // throttle setiap 30ms
    last = now;

    const t = Number(seek.value) / 1000;
    video.currentTime = t;
  });

  seek.addEventListener('change', () => {
    video.currentTime = Number(seek.value) / 1000;
    seek.dragging = false;
  });

  // Keyboard controls
  function onKey(e) {
    if (e.key === 'ArrowRight') video.currentTime = Math.min(video.duration, video.currentTime + 5);
    else if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 5);
  }
  window.addEventListener('keydown', onKey);

  // Play/Pause toggle on video click
  video.addEventListener('click', () => { if (video.paused) video.play(); else video.pause(); });
  video.addEventListener('play', () => playBtn.textContent = 'Pause');
  video.addEventListener('pause', () => playBtn.textContent = 'Play');

  document.body.appendChild(overlay);

  // Cleanup when overlay removed
  const cleanup = () => {
    video.removeEventListener('timeupdate', timeUpdateHandler);
    window.removeEventListener('keydown', onKey);
  };
  const observer = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      cleanup();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function openPdfLightbox(file) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.95)';
  overlay.style.zIndex = 9999;
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';

  const iframe = document.createElement('iframe');
  iframe.src = "file:///" + file.path.replace(/\\/g, '/');
  iframe.style.flex = '1';
  iframe.style.border = 'none';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.padding = '8px';
  closeBtn.style.background = '#fff';
  closeBtn.style.border = 'none';
  closeBtn.onclick = () => overlay.remove();

  overlay.appendChild(closeBtn);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}

function renderFolderFiles(files) {
  const container = document.getElementById("folder-view");
  if (!container) return;

  container.innerHTML = "";

  files = files.map(f => ({
    ...f,
    url: "file:///" + f.path.replace(/\\/g, "/")
  }));

  const reports = files.filter(f => f.ext === ".pdf");
  const photos = files.filter(f => [".jpg", ".jpeg", ".png"].includes(f.ext));
  const videos = files.filter(f => [".mp4", ".mov", ".avi", ".webm"].includes(f.ext));

  function addSection(title, list) {
    if (list.length === 0) return;

    const section = document.createElement("div");
    section.classList.add("section");

    const grid = document.createElement("div");
    grid.classList.add("section-grid");

    section.innerHTML = `<h3>${title}</h3>`;
    section.appendChild(grid);

    list.forEach(f => {
      const item = document.createElement("div");
      item.classList.add("folder-item");

      if ([".jpg", ".jpeg", ".png"].includes(f.ext)) {
        item.innerHTML = `
          <img src="${f.url}">
          <div class="filename">${f.name}</div>
        `;
        // klik buka lightbox
        item.addEventListener("click", () => {
          const index = photos.findIndex(p => p.path === f.path);
          openLightbox(photos, index);
        });
      } else if ([".mp4", ".mov", ".avi", ".webm"].includes(f.ext)) {
        item.innerHTML = `
          <video src="${f.url}" muted preload="metadata"></video>
          <div class="filename">${f.name}</div>
        `;
        // klik buka video lightbox
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => openVideoLightbox(f));
      } else if (f.ext === ".pdf") {
        item.innerHTML = `
          <img src="icons/pdf.png">
          <div class="filename">${f.name}</div>
        `;
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => openPdfLightbox(f));
      }

      grid.appendChild(item);
    });

    container.appendChild(section);
  }

  addSection("Photo", photos);
  addSection("Video", videos);
  addSection("Report", reports);
}

async function openEditPage(folderPath, patientId) {
  console.log("📄 Membuka edit.html untuk:", folderPath);
  console.log("🆔 ID pasien:", patientId);

  const target = document.querySelector("#reports-content");
  const html = window.electronAPI.loadHTML("views/edit.html");
  target.innerHTML = html;

  await new Promise(resolve => setTimeout(resolve, 50));

  window.currentReportFolder = folderPath;
  window.currentPatientId = patientId;

  const mrn = folderPath.split("/")[0];
  console.log("🔍 MRN terdeteksi:", mrn);

  const patient = await window.electronAPI.getPatientByMRN(mrn);
  console.log("📌 DATA PASIEN:", patient);

  // ⬅️ PENTING — Render form pasien
  window.renderPatientInfo(patient);

  const files = await window.electronAPI.getFolderFiles(folderPath);

  if (window.renderEditPage) {
    window.renderEditPage(files, folderPath, patientId);
  }
}

async function openDeletePage(folderPath, procedureId) {
  console.log("🗑 Membuka delete.html:", folderPath, procedureId);

  const target = document.querySelector("#reports-content");
  const html = window.electronAPI.loadHTML("views/delete.html");
  target.innerHTML = html;

  await new Promise(res => setTimeout(res, 50));

  window.currentDeleteFolder = folderPath;
  window.currentDeleteProcedureId = procedureId;

  // Dapatkan MRN dari folderPath
  const mrn = folderPath.split("/")[0];
  const patient = await window.electronAPI.getPatientByMRN(mrn);

  const procedure = await window.electronAPI.getProcedureById(procedureId);

  // console.log("👤 Pasien:", patient);
  // console.log("📄 Prosedur:", procedure);
  console.log(folderPath);

  if (window.renderDeletePage) {
    window.renderDeletePage(patient, procedure);
  }
}

function renderSearchPatients(rows) {
  const tbody = document.querySelector("#patients-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.mrn}</td>
      <td>${r.name}</td>
      <td>${r.age}</td>
      <td>${r.sex}</td>
    `;
    tbody.appendChild(tr);
  });
}

// UI module (modularized for easier editing)
if (typeof App === 'undefined') window.App = {};
App.UI = {
  init: async function () {
    // ===== Fungsi umum untuk load HTML ke tab =====
    function loadTabContent(tabId, fileName, callback) {
      // console.log(`🧩 Load tab content for ${tabId}`);
      const html = window.electronAPI.loadHTML(`views/${fileName}`);
      $(`#${tabId}-content`).html(html);
      // console.log(`✅ HTML loaded into #${tabId}-content`);

      if (callback) callback();
    }

    // ===== Awal: load tab Patients =====
    loadTabContent("patients", "patients.html", initPatientsForm);
    // Default: disable settings until Reports tab is activated
    setSettingsTabEnabled(false);

    // ===== Event tab dinamis Bootstrap =====
    $(document).on("click", 'button[data-bs-toggle="tab"]', async function (e) {
      e.preventDefault(); // cegah behaviour bootstrap dulu
      // Use the element the event was bound to (currentTarget / this)
      const btn = e.currentTarget || this;

      // Try to read data-bs-target from the button; fallback to dataset.tab
      let dataTarget = btn.getAttribute("data-bs-target") || btn.dataset?.tab;

      // If not found (e.g. click landed on inner element), try to locate the closest button
      if (!dataTarget) {
        const closestBtn = e.target.closest('button[data-bs-toggle="tab"]');
        dataTarget = closestBtn ? (closestBtn.getAttribute("data-bs-target") || closestBtn.dataset?.tab) : null;
      }

      if (!dataTarget) return; // nothing to do

      const target = dataTarget.replace(/^#/, "");

      // console.log("🧭 Klik tab:", target);
      if (target === "procedure") {
        if (!selectedPatient) {
          Swal.fire({
            icon: "warning",
            title: "Pilih pasien terlebih dahulu",
            text: "Klik salah satu pasien di tabel sebelum membuka tab Procedure.",
          });
          return;
        }

        // ✅ Load procedure.html dan masukkan ke tab
        const html = window.electronAPI.loadHTML("views/procedure.html");
        $("#procedure-content").html(html);
        // console.log("📄 Procedure HTML loaded");

        // console.log("🎥 Init kamera...");

        // Camera helpers are initialized inside initCameraSystem below

        document.getElementById("btn-start-procedure").addEventListener("click", async () => {
          if (!selectedPatient) {
            Swal.fire({
              icon: "warning",
              title: "Tidak ada pasien dipilih",
              text: "Silakan pilih pasien terlebih dahulu di tab Patients.",
            });
            return;
          }
          console.log("DEBUG selectedProcedure:", selectedProcedure);

          const confirmResult = await Swal.fire({
            title: "Patient Confirmation",
            html: `
              <div class="text-start">
                <p><strong>Name:</strong> ${selectedPatient.name}</p>
                <p><strong>MR:</strong> ${selectedPatient.mrn}</p>
                <p><strong>Procedure:</strong> ${selectedProcedure.procedure}</p>
              </div>
              <p>Is the patient data correct?</p>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "✅ Yes",
            cancelButtonText: "🔙 No",
          });

          if (confirmResult.isConfirmed) {
            // 🔒 Disable tab Patients supaya tidak keluar dari workflow
            window.addEventListener("beforeunload", handleBeforeUnload);

            const patientsTabButton = document.querySelector('button[data-bs-target="#patients"]');
            if (patientsTabButton) patientsTabButton.disabled = true;

            // 🔒 Disable tab Reports as well while procedure is running
            const reportsTabButton = document.querySelector('button[data-bs-target="#reports-tabpane"]') || document.getElementById("reports-tab");
            if (reportsTabButton) {
              reportsTabButton.disabled = true;
              reportsTabButton.classList.add("disabled");
              reportsTabButton.setAttribute("aria-disabled", "true");
              // If there's a tab element that should be visually muted
              try { if (reportsTabButton.style) reportsTabButton.style.pointerEvents = "none"; } catch (e) { }
            }

            // 🧩 Sembunyikan tombol "Mulai Tindakan"
            const startButton = document.getElementById("btn-start-procedure");
            if (startButton) startButton.style.display = "none";

            // 🎥 Tampilkan video section
            document.getElementById("video-section").style.display = "block";

            // 🕒 Buat folder sesi (global)
            const mrn = selectedPatient.mrn;
            const procedureDate = formatDate(new Date());
            const procedureTime = formatTime(new Date());
            const procedureName = selectedProcedure.procedure;        // "Gastroscopy"
            const procedureId = selectedProcedure.procedure_id;       // 1,2,3...

            await startProcedureSession(mrn, procedureName, procedureId);
            // await startProcedureSession(mrn, procedure);

            // 🎥 Jalankan kamera
            await initCameraSystem();
            procedureStarted = true;

          } else {
            // 🔄 Kembali ke tab Patients
            const patientsTabButton = document.querySelector('button[data-bs-target="#patients"]');
            if (patientsTabButton) patientsTabButton.click();
          }
        });

        // ===== Fungsi Kamera (reusable) =====
        async function initCameraSystem() {
          const videoElement = document.getElementById("camera-preview");
          const cameraSelect = document.getElementById("camera-select");
          let currentStream = null;

          function stopMediaTracks(stream) {
            if (stream) stream.getTracks().forEach((t) => t.stop());
          }

          async function startCamera(deviceId) {
            try {
              if (currentStream) stopMediaTracks(currentStream);

              const constraints = {
                video: deviceId ? { deviceId: { exact: deviceId } } : true,
              };

              const stream = await navigator.mediaDevices.getUserMedia(constraints);
              videoElement.srcObject = stream;
              currentStream = stream;
            } catch (err) {
              console.error("🚫 Gagal membuka kamera:", err);
              Swal.fire({
                icon: "error",
                title: "Kamera tidak dapat diakses",
                text: err.message,
              });
            }
          }

          async function loadCameraList() {
            try {
              const devices = await navigator.mediaDevices.enumerateDevices();
              const videoDevices = devices.filter((d) => d.kind === "videoinput");

              cameraSelect.innerHTML = "";
              videoDevices.forEach((device, index) => {
                const option = document.createElement("option");
                option.value = device.deviceId;
                option.text = device.label || `Kamera ${index + 1}`;
                cameraSelect.appendChild(option);
              });

              if (videoDevices.length > 0) {
                await startCamera(videoDevices[0].deviceId);
                cameraSelect.value = videoDevices[0].deviceId;
              } else {
                Swal.fire({ icon: "warning", title: "Tidak ada kamera terdeteksi" });
              }
            } catch (err) {
              console.error("🚫 Tidak bisa memuat daftar kamera:", err);
            }
          }

          cameraSelect.addEventListener("change", async (e) => {
            await startCamera(e.target.value);
          });

          await loadCameraList();

          // 🎛️ Tombol Capture dan Record
          const btnCapture = document.getElementById("btn-capture");
          const btnRecord = document.getElementById("btn-record");

          if (btnCapture) {
            btnCapture.addEventListener("click", async () => {
              await captureImage(videoElement, selectedPatient);
              Swal.fire({
                icon: "success",
                title: "Photo Saved",
                timer: 1200,
                showConfirmButton: false,
              });
            });
          }

          if (btnRecord) {
            let isRecording = false;
            btnRecord.addEventListener("click", async () => {
              if (!isRecording) {
                await startRecording(videoElement.srcObject, selectedPatient);
                isRecording = true;
                btnRecord.textContent = "⏹️ Stop";
                btnRecord.classList.replace("btn-danger", "btn-secondary");
              } else {
                if (!selectedPatient) {
                  console.error("❌ selectedPatient tidak terdefinisi!");
                  return;
                }
                await stopRecording(selectedPatient);
                isRecording = false;
                btnRecord.textContent = "⏺️ Record";
                btnRecord.classList.replace("btn-secondary", "btn-danger");
              }
            });
          }
        }

        // 🎯 Tombol Finish Procedure
        const btnFinish = document.getElementById("btn-finish");
        if (btnFinish) {
          btnFinish.addEventListener("click", async () => {
            const result = await Swal.fire({
              title: "Finish Procedure?",
              text: "Make sure all photos and videos have been taken.",
              icon: "question",
              showCancelButton: true,
              confirmButtonText: "✅ Yes, Finish",
              cancelButtonText: "❌ No",
              reverseButtons: true,
            });

            if (result.isConfirmed) {
              console.log("🟡 Status sebelum update:", selectedPatient.status, selectedPatient);

              await window.electronAPI.updatePatientStatus({
                // id: selectedPatient.id,
                procedure_id: selectedProcedure.procedure_id,
                status: "finish",
              });

              selectedPatient.status = "finish";

              // Segarkan daftar pasien di tab Patients jika sedang terlihat
              try { await refreshPatientsList(); } catch (e) { /* ignore */ }

              // 🟢 Log sesudah update
              console.log("🟢 Status sesudah update:", selectedPatient.status, selectedPatient);

              // 🛑 Matikan kamera
              const videoElement = document.getElementById("camera-preview");
              const stream = videoElement?.srcObject;
              if (stream) {
                stream.getTracks().forEach((track) => track.stop());
                videoElement.srcObject = null;
              }

              // 🔒 Nonaktifkan tombol kamera
              const btnCapture = document.getElementById("btn-capture");
              const btnRecord = document.getElementById("btn-record");
              if (btnCapture) btnCapture.disabled = true;
              if (btnRecord) btnRecord.disabled = true;

              // 🔒 Disable tab Procedure agar tidak bisa kembali
              const procedureTabButton = document.getElementById("procedure-tab");
              if (procedureTabButton) {
                procedureTabButton.classList.add("disabled");
                procedureTabButton.disabled = true;
                procedureTabButton.setAttribute("aria-disabled", "true");
              }

              procedureLocked = true;

              // 🔓 Buka kembali tab Patients jika mau mulai lagi nanti
              const patientsTabButton = document.getElementById("patients-tab");
              if (patientsTabButton) {
                patientsTabButton.disabled = false;
                patientsTabButton.classList.remove("disabled");
                patientsTabButton.removeAttribute("aria-disabled");
              }

              // 🔓 Re-enable Reports tab when procedure finished
              const reportsTabBtn = document.querySelector('button[data-bs-target="#reports-tabpane"]') || document.getElementById("reports-tab");
              if (reportsTabBtn) {
                reportsTabBtn.disabled = false;
                reportsTabBtn.classList.remove("disabled");
                reportsTabBtn.removeAttribute("aria-disabled");
                try { if (reportsTabBtn.style) reportsTabBtn.style.pointerEvents = "auto"; } catch (e) { }
                try { if (reportsTabBtn.style) reportsTabBtn.style.opacity = "1"; } catch (e) { }
              }

              // 🔄 Pindah ke tab Reports
              const reportTab = document.getElementById("reports-tab");
              if (reportTab) reportTab.click();

              // 🖼️ Tunggu sedikit biar DOM report muncul
              setTimeout(() => {
                if (currentSession) {
                  console.log("📸 Memuat galeri dari:", currentSession);
                  loadGalleryFromFolder(currentSession);
                } else {
                  console.warn("⚠️ Tidak ada currentSession, galeri tidak dimuat");
                }
              }, 500);

              // ✅ Notifikasi sukses
              Swal.fire({
                icon: "success",
                title: "Procedure Completed!",
                text: "Please fill out the report in the Reports tab.",
                timer: 1500,
                showConfirmButton: false
              });

              // 🚫 Hapus listener beforeunload supaya aman keluar
              window.removeEventListener("beforeunload", handleBeforeUnload);

              // 🔁 Reset state
              procedureStarted = false;
            }
          });
        }

        // 🧠 Setelah HTML dimasukkan, isi header dengan data pasien aktif
        $("#active-patient-name").text(selectedPatient.name);
        $("#active-patient-mrn").text(`No RM: ${selectedPatient.mrn}`);
        $("#active-procedure").text(selectedProcedure.procedure);

        // Pindahkan tab aktif secara manual
        $("button.nav-link").removeClass("active");
        $(this).addClass("active");
        $(".tab-pane").removeClass("show active");
        $("#procedure-tabpane").addClass("show active");
        // Disable settings while on Procedure
        setSettingsTabEnabled(false);
      }

      else if (target === "patients") {
        loadTabContent(target, "patients.html", initPatientsForm);
        $("button.nav-link").removeClass("active");
        $(this).addClass("active");

        $(".tab-pane").removeClass("show active");
        $("#patients").addClass("show active");
        // Disable settings while on Patients
        setSettingsTabEnabled(false);
      }

      else if (target === "reports-tabpane") {
        console.log("🟦 Reports tab diklik, mulai load reports.html");

        try {
          // Ambil HTML
          const html = window.electronAPI.loadHTML("views/reports.html");

          // Masukkan ke kontainer
          $("#reports-content").html(html);

          console.log("🟩 reports.html berhasil dimuat");

          // 🔥 PENTING → Setelah HTML siap, isi tabel
          setTimeout(() => {
            renderReportsTable();
          }, 0);

          // document.querySelector("#search-reports").addEventListener("input", async (e) => {
          //   const q = e.target.value.trim();

          //   // Jika kolom search kosong → tampilkan semua kembali
          //   if (q === "") {
          //     const all = await window.electronAPI.getReports();
          //     allReports = all;
          //     renderReportsRows(allReports);
          //     return;
          //   }

          //   // 1️⃣ hasil search JOIN patients + procedures
          //   const searchResults = await window.electronAPI.searchPatients(q);

          //   // 2️⃣ mapping ke format renderReportsRows()
          //   const mapped = searchResults.map(r => ({
          //     id: r.procedure_id,
          //     patient_id: r.patient_id,
          //     mrnName: `${r.mrn}-${r.name}`,
          //     procedure: r.procedure,
          //     // date: r.date_procedure,
          //     date: formatDate(r.date_procedure),
          //     time: r.procedure_time,
          //     folderPath: `${r.mrn}-${r.name}/${r.procedure_id}`,
          //     hasPdf: false
          //   }));

          //   // 3️⃣ tampilkan
          //   renderReportsRows(mapped);

          //   console.log("🔍 Hasil pencarian mapped:", mapped);
          // });

          document.querySelector("#search-reports").addEventListener("input", async (e) => {
            const q = e.target.value.trim();

            if (q === "") {
              const all = await window.electronAPI.getReports();
              allReports = all;
              renderReportsRows(allReports);
              return;
            }

            // 1️⃣ Ambil data mentah dari pencarian DB
            const searchResults = await window.electronAPI.searchPatients(q);

            // 2️⃣ Mapping dan cek status PDF untuk setiap hasil
            const mapped = await Promise.all(searchResults.map(async (r) => {
              // Panggil fungsi yang baru kita buat di main.js
              const status = await window.electronAPI.checkPdfStatus(r);

              return {
                id: r.procedure_id,
                patient_id: r.patient_id,
                mrnName: `${r.mrn}-${r.name}`,
                procedure: r.procedure,
                date: formatDate(r.date_procedure), // Menggunakan dd-mm-yyyy yang kita buat tadi
                time: r.procedure_time || "-",
                folderPath: status.folderKey,       // Diambil dari hasil cek folder di main
                hasPdf: status.hasPdf               // Sekarang dinamis (true/false)
              };
            }));

            // 3️⃣ Tampilkan ke tabel
            renderReportsRows(mapped);
          });

        } catch (err) {
          console.error("❌ Gagal load reports.html:", err);
        }
        // Update nav agar active
        $("button.nav-link").removeClass("active");
        $("#reports-tab").addClass("active");

        // Ganti tab aktif
        $(".tab-pane").removeClass("show active");
        $("#reports-tabpane").addClass("show active");
        // Enable settings when on Reports
        setSettingsTabEnabled(true);
      }

      else if (target === "settings") {
        console.log("⚙ Settings tab diklik, load settings.html");

        try {
          const html = window.electronAPI.loadHTML("views/settings.html");
          $("#settings").html(html);

          console.log("🟩 settings.html berhasil dimuat");

          // setelah HTML masuk, barulah ambil UI-nya
          setTimeout(() => {
            const saveBtn = document.getElementById("save-settings");
            if (!saveBtn) {
              console.error("❌ save-settings not found");
              return;
            }

            saveBtn.addEventListener("click", async () => {
              try {
                // support multiple possible input IDs (backwards compatibility)
                const rsEl = document.getElementById("rs") || document.getElementById("settings-storage-path");
                const detailEl = document.getElementById("detail-rs") || document.getElementById("settings-export-format");
                const logoInput = document.getElementById("logo-upload") || document.getElementById("logo-file") || null;

                const rs = rsEl ? (rsEl.value ?? '').toString().trim() : "";
                const detailRs = detailEl ? (detailEl.value ?? '').toString().trim() : "";
                const logoFile = logoInput && logoInput.files && logoInput.files[0] ? logoInput.files[0] : null;

                let logoPath = null;

                if (logoFile) {
                  const arrayBuffer = await logoFile.arrayBuffer();
                  // Buffer may be available via preload; fallback gracefully
                  const buffer = typeof Buffer !== 'undefined' ? Buffer.from(arrayBuffer) : new Uint8Array(arrayBuffer);

                  if (window.electronAPI && window.electronAPI.saveLogo) {
                    logoPath = await window.electronAPI.saveLogo({
                      name: logoFile.name,
                      data: buffer
                    });
                  }
                }

                if (window.electronAPI && window.electronAPI.saveSettings) {
                  await window.electronAPI.saveSettings({ rs, detailRs, logoPath });
                } else {
                  // fallback: save to localStorage
                  localStorage.setItem('appSettings', JSON.stringify({ rs, detailRs, logoPath }));
                }

                Swal.fire({ icon: "success", title: "Settings saved!" });
              } catch (err) {
                console.error("Error saving settings:", err);
                try { Swal.fire({ icon: 'error', title: 'Save failed', text: err?.message || String(err) }); } catch (e) { console.error(e); }
              }
            });
          }, 0);

        } catch (err) {
          console.error("❌ Gagal load settings.html:", err);
        }

        // update nav tab
        $("button.nav-link").removeClass("active");
        $("#settings-tab").addClass("active");

        $(".tab-pane").removeClass("show active");
        $("#settings").addClass("show active");
      }
    });

    // ===== Fungsi tab Patients =====
    function initPatientsForm() {
      const form = document.getElementById("patient-form");
      const tableBody = document.querySelector("#patient-table tbody");
      const editBtn = document.getElementById("edit-btn");
      const deleteBtn = document.getElementById("delete-btn");
      const saveBtn = form.querySelector("button[type=submit]");
      const resetBtn = form.querySelector("button[type=reset]");
      const procedureTab = document.getElementById("procedure-tab");

      let currentMode = "add"; // "add" atau "update"
      let selectedMRN = null;
      let selectedId = null;

      if (!form || !tableBody) return;

      async function loadPatients() {
        const patients = await window.electronAPI.getPatients();
        let rows = [];

        for (const p of patients) {
          // Ambil prosedur pasien
          const procedures = await window.electronAPI.getProceduresByPatientId(p.patient_id);

          // Hanya tampilkan prosedur dengan status "queue"
          const queueProcedures = procedures.filter(proc => proc.status === "queue");

          queueProcedures.forEach(proc => {
            rows.push(`
              <tr data-id="${p.patient_id}" data-procedure-id="${proc.procedure_id}">
                <td>${p.mrn}</td>
                <td>${p.name}</td>
                <td>${p.age}</td>
                <td>${p.sex}</td>
                <td>${proc.procedure}</td>
                <td>${proc.doctor_name}</td>
              </tr>
            `);
          });
        }

        const tableBody = document.querySelector("#patient-table tbody");
        tableBody.innerHTML = rows.join("");
      }

      loadPatients();

      // ===== Klik pasien di tabel =====
      tableBody.addEventListener("click", async (e) => {
        const tr = e.target.closest("tr");
        if (!tr) return;

        const patient_id = tr.dataset.id;
        const procedure_id = tr.dataset.procedureId;

        // Ambil pasien dan prosedur
        const patient = await window.electronAPI.getPatientById(patient_id);
        const procedures = await window.electronAPI.getProceduresByPatientId(patient_id);
        if (!patient) return;

        selectedPatient = patient;
        selectedProcedure = procedures.find(p => p.procedure_id == procedure_id); // assign global
        console.log("🟢 Selected procedure:", selectedProcedure);

        // Isi form pasien
        for (const key in patient) {
          const el = document.getElementById(key);
          if (el) el.value = patient[key];
        }

        // Isi dropdown procedure
        const procedureSelect = document.getElementById("procedure");
        procedureSelect.innerHTML = procedures.map(p =>
          `<option value="${p.procedure}">${p.procedure}</option>`
        ).join('');

        // Pilih prosedur pertama yang status = queue, kalau tidak ada pilih prosedur pertama
        if (selectedProcedure) {
          procedureSelect.value = selectedProcedure.procedure;

          const fields = ["doctor_name", "date_procedure", "referring_doctor", "class", "bed", "complaint", "diagnose"];
          fields.forEach(f => {
            const el = document.getElementById(f);
            if (el) el.value = selectedProcedure[f] || "";
          });
        }

        // Saat dropdown procedure berubah, update input terkait
        procedureSelect.onchange = () => {
          const p = procedures.find(proc => proc.procedure === procedureSelect.value);
          if (!p) return;
          const fields = ["doctor_name", "date_procedure", "referring_doctor", "class", "bed", "complaint", "diagnose"];
          fields.forEach(f => {
            const el = document.getElementById(f);
            if (el) el.value = p[f] || "";
          });
        };

        // Readonly / tombol mode
        setFormReadonly(true);
        editBtn.disabled = false;
        deleteBtn.disabled = false;
        saveBtn.disabled = true;
        currentMode = "update";

        selectedMRN = patient.mrn;
        selectedId = patient.patient_id;

        procedureLocked = false;
        if (!procedureLocked) {
          procedureTab.classList.remove("tab-locked", "disabled");
          procedureTab.disabled = false;
          procedureTab.removeAttribute("aria-disabled");
          procedureTab.style.pointerEvents = "auto";
          procedureTab.style.opacity = "1";
        }

        procedureTab.dataset.patientName = patient.name;
        procedureTab.dataset.patientMrn = patient.mrn;
      });

      // ===== Tombol Edit =====
      editBtn.addEventListener("click", () => {
        setFormReadonly(false);
        document.getElementById("mrn").readOnly = true;
        saveBtn.disabled = false;
      });

      // ===== Tombol Delete =====
      deleteBtn.addEventListener("click", async () => {
        if (!selectedMRN) {
          Swal.fire({ icon: "warning", title: "Pilih pasien terlebih dahulu" });
          return;
        }

        const result = await Swal.fire({
          title: `Hapus pasien dengan MRN ${selectedMRN}?`,
          text: "Sistem akan menyesuaikan penghapusan berdasarkan status prosedur.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Hapus",
          cancelButtonText: "Batal",
        });

        if (!result.isConfirmed) return;

        // PANGGIL IPC BARU
        const res = await window.electronAPI.deletePatientOrProcedures(
          selectedPatient.patient_id
        );

        if (res.type === "delete_queue_only") {
          console.log("Hanya procedure queue yang dihapus");
        } else {
          console.log("Semua data patient + procedure dihapus");
        }

        await loadPatients();

        form.reset();
        setFormReadonly(false);
        document.getElementById("mrn").readOnly = false;

        editBtn.disabled = true;
        deleteBtn.disabled = true;
        saveBtn.disabled = false;

        currentMode = "add";
        selectedMRN = null;
        selectedPatient = null;

        procedureTab.classList.add("tab-locked");
        procedureTab.style.pointerEvents = "none";
        procedureTab.style.opacity = "0.6";

        Swal.fire({ icon: "success", title: "Data berhasil dihapus" });
      });

      // ===== Tombol New / Reset =====
      resetBtn.addEventListener("click", () => {
        form.reset();
        setFormReadonly(false);
        document.getElementById("mrn").readOnly = false;
        editBtn.disabled = true;
        deleteBtn.disabled = true;
        saveBtn.disabled = false;
        currentMode = "add";
        selectedMRN = null;
        selectedPatient = null;
      });

      // Auto-suggest for Doctor Name
      const doctorInput = document.getElementById("doctor_name");
      const suggestionBox = document.getElementById("doctorSuggestions");

      let doctorTimer;

      doctorInput.addEventListener("input", () => {
        clearTimeout(doctorTimer);

        const q = doctorInput.value.trim();
        if (!q) {
          suggestionBox.classList.add("d-none");
          return;
        }

        doctorTimer = setTimeout(async () => {
          const doctors = await window.electronAPI.suggestDoctors(q);

          suggestionBox.innerHTML = "";
          if (!doctors.length) {
            suggestionBox.classList.add("d-none");
            return;
          }

          // doctors.forEach(d => {
          //   const li = document.createElement("li");
          //   li.className = "list-group-item list-group-item-action";
          //   li.textContent = d.name;
          //   li.onclick = () => {
          //     doctorInput.value = d.name;
          //     suggestionBox.classList.add("d-none");
          //   };
          //   suggestionBox.appendChild(li);
          // });

          doctors.forEach(d => {
            const li = document.createElement("li");
            li.className =
              "list-group-item d-flex justify-content-between align-items-center";
            li.style.cursor = "pointer";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = d.name;

            const deleteSpan = document.createElement("span");
            deleteSpan.textContent = "❌";
            deleteSpan.style.cursor = "pointer";
            deleteSpan.style.fontSize = "14px";
            deleteSpan.style.color = "red";

            deleteSpan.onclick = async (e) => {
              e.stopPropagation(); // ⛔ jangan trigger pilih dokter
              await window.electronAPI.deleteDoctor(d.doctor_id);
              li.remove();
            };

            li.onclick = () => {
              doctorInput.value = d.name;
              suggestionBox.classList.add("d-none");
            };

            li.appendChild(nameSpan);
            li.appendChild(deleteSpan);
            suggestionBox.appendChild(li);
          });

          suggestionBox.classList.remove("d-none");
        }, 250);
      });

      // Auto-suggest for Procedure (Master Examinations)
      const procedureInput = document.getElementById("procedure");
      const procedureSuggestionBox = document.getElementById("procedureSuggestions");

      let procedureTimer;

      procedureInput.addEventListener("input", () => {
        clearTimeout(procedureTimer);
        const q = procedureInput.value.trim();

        if (!q) {
          procedureSuggestionBox.classList.add("d-none");
          return;
        }

        procedureTimer = setTimeout(async () => {
          // Gunakan API baru (kita buat di main.js nanti)
          const suggestions = await window.electronAPI.suggestExaminations(q);

          procedureSuggestionBox.innerHTML = "";
          if (!suggestions.length) {
            procedureSuggestionBox.classList.add("d-none");
            return;
          }

          suggestions.forEach(item => {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-center";
            li.style.cursor = "pointer";

            li.innerHTML = `
            <span>${item.name}</span>
            <span class="text-danger delete-exam" data-id="${item.examination_id}" style="cursor:pointer">❌</span>
          `;

            // Klik untuk pilih
            li.onclick = () => {
              procedureInput.value = item.name;
              procedureSuggestionBox.classList.add("d-none");
            };

            // Klik untuk hapus dari master (opsional)
            const delBtn = li.querySelector(".delete-exam");
            delBtn.onclick = async (e) => {
              e.stopPropagation();
              await window.electronAPI.deleteExamination(item.examination_id);
              li.remove();
            };

            procedureSuggestionBox.appendChild(li);
          });

          procedureSuggestionBox.classList.remove("d-none");
        }, 250);
      });

      // Sembunyikan box jika klik di luar
      document.addEventListener("click", (e) => {
        if (e.target !== procedureInput) procedureSuggestionBox.classList.add("d-none");
      });

      // =====================================================
      //  🔍 AUTO-CHECK MRN SAAT USER MENGETIK
      // =====================================================

      const mrnInput = document.getElementById("mrn");
      let mrnTimer;

      mrnInput.addEventListener("input", () => {
        clearTimeout(mrnTimer);

        mrnTimer = setTimeout(async () => {
          const mrn = mrnInput.value.trim();
          if (!mrn) return;

          const patient = await window.electronAPI.getPatientByMRN(mrn);

          if (patient) {
            console.log("🟢 MRN ditemukan:", patient);

            // Prefill HANYA field tertentu
            const allowedFields = ["name", "date_of_birth", "address", "sex", "telephone", "city"];

            allowedFields.forEach((field) => {
              const el = document.getElementById(field);
              if (el && patient[field] !== undefined) {
                el.value = patient[field];
              }
            });

            // Auto-hitungan umur
            if (patient.date_of_birth) {
              ageInput.value = calculateAge(new Date(patient.date_of_birth));
            }

            // Aktifkan mode update
            setFormReadonly(false);
            editBtn.disabled = true;
            deleteBtn.disabled = true;
            saveBtn.disabled = false;

            currentMode = "update";
            selectedId = patient.patient_id;
            selectedMRN = patient.mrn;

          } else {
            console.log("🔵 MRN baru, input data pasien baru");

            // Kosongkan form kecuali MRN
            Array.from(form.elements).forEach((el) => {
              if (el.id !== "mrn") el.value = "";
            });

            setFormReadonly(false);
            editBtn.disabled = true;
            deleteBtn.disabled = true;
            saveBtn.disabled = false;

            currentMode = "add";
            selectedId = null;
            selectedMRN = null;
          }
        }, 400); // debounce
      });

      // =====================================================
      //  📌 AUTO-HITUNG AGE DARI DATE OF BIRTH
      // =====================================================

      const dobInput = document.getElementById("date_of_birth");
      const ageInput = document.getElementById("age");

      dobInput.addEventListener("change", () => {
        const dob = new Date(dobInput.value);
        if (!isNaN(dob)) {
          ageInput.value = calculateAge(dob);
        }
      });

      function calculateAge(dob) {
        const diff = Date.now() - dob.getTime();
        const ageDate = new Date(diff);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
      }

      // ===== Submit Form (Save / Update) =====
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const patientData = {
          mrn: document.getElementById("mrn").value.trim(),
          name: document.getElementById("name").value.trim(),
          date_of_birth: document.getElementById("date_of_birth").value,
          age: calculateAge(new Date(document.getElementById("date_of_birth").value)),
          sex: document.getElementById("sex").value,
          address: document.getElementById("address").value.trim(),
          city: document.getElementById("city").value.trim(),
          telephone: document.getElementById("telephone").value.trim(),
        };

        const procedureData = {
          procedure: document.getElementById("procedure").value,
          doctor_name: document.getElementById("doctor_name").value,
          date_procedure: document.getElementById("date_procedure").value,
          referring_doctor: document.getElementById("referring_doctor").value,
          class: document.getElementById("class").value,
          bed: document.getElementById("bed").value,
          complaint: document.getElementById("complaint").value,
          diagnose: document.getElementById("diagnose").value,
          status: "queue"
        };

        try {
          // Cek dulu apakah dokter sudah ada
          const doctorName = document.getElementById("doctor_name").value.trim();
          const examination = document.getElementById("procedure").value.trim();

          if (doctorName) {
            await window.electronAPI.insertDoctorIfNotExists(doctorName);
            await window.electronAPI.insertExaminationIfNotExists(examination);
          }

          // Cek dulu apakah MRN sudah ada
          const existingPatient = await window.electronAPI.getPatientByMRN(patientData.mrn);

          if (existingPatient) {
            // Pasien lama → cukup insert procedure baru
            await window.electronAPI.addProcedure({
              ...procedureData,
              patient_id: existingPatient.patient_id
            });
            console.log("✅ Procedure baru untuk pasien lama ditambahkan");
          } else {
            // Pasien baru → insert pasien + procedure
            const result = await window.electronAPI.addPatient({
              ...patientData,
              ...procedureData // main.js sudah insert procedure otomatis
            });

            if (!result.success) throw new Error(result.error);

            console.log("➕ Pasien baru ditambahkan dengan ID:", result.patient_id);
          }

          await loadPatients();
          form.reset();
          setFormReadonly(false);
          document.getElementById("mrn").readOnly = false;
          editBtn.disabled = true;
          deleteBtn.disabled = true;
          saveBtn.disabled = false;

        } catch (err) {
          console.error("❌ Gagal menyimpan:", err.message);
        }
      });
    }

    // ===== Fungsi bantu =====
    function setFormReadonly(isReadonly) {
      const formElements = document.querySelectorAll("#patient-form input, #patient-form select, #patient-form textarea");
      formElements.forEach((el) => {
        if (el.type !== "button" && el.type !== "submit" && el.type !== "reset") {
          el.readOnly = isReadonly;
          el.disabled = isReadonly && el.tagName === "SELECT";
        }
      });
    }

    function handleBeforeUnload(e) {
      const activeTab = getActiveTab();
      // console.log("beforeunload triggered:", { activeTab, procedureStarted });

      if (activeTab !== "procedure" || !procedureStarted) {
        return; // langsung tutup tanpa swal
      }

      e.preventDefault();
      e.returnValue = "";

      Swal.fire({
        title: "Procedure in Progress",
        text: "Are you sure you want to leave?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, close it",
        cancelButtonText: "No",
      }).then((result) => {
        if (result.isConfirmed) {
          // console.log("✅ Dokter konfirmasi selesai, menutup window...");
          procedureStarted = false;
          window.removeEventListener("beforeunload", handleBeforeUnload);
          window.close();
        }
      });

      e.returnValue = false;
    }
  }
};

$(document).ready(function () { App.UI.init(); });

async function loadGalleryFromFolder(folderPath) {
  if (!folderPath) return;

  const files = await window.electronAPI.readFolder(folderPath);
  const galleryContainer = document.getElementById("gallery-items");
  if (!galleryContainer) return;

  galleryContainer.innerHTML = "";

  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));

  imageFiles.forEach(filePath => {
    const img = document.createElement("img");
    img.src = `file://${filePath}`;
    img.classList.add("gallery-thumb");
    galleryContainer.appendChild(img);
  });
}

window.renderPatientInfo = function (patient) {
  const target = document.querySelector("#patient-info");
  if (!target) return;

  let html = `<h5 class="fw-semibold mb-3">Patient Information</h5>`;
  html += `<form id="patient-update-form" class="row g-3">`;

  for (const key in patient) {
    if (key === "patient_id") continue;

    let type = "text";
    if (key === "date_of_birth") type = "date";
    if (key === "age") type = "number";

    // CONDITION: mrn readonly, uppercase
    const isMRN = key === "mrn";

    html += `
      <div class="col-md-6">
        <label class="form-label text-capitalize">${key.replace(/_/g, " ")}</label>
        <input 
          type="${type}" 
          class="form-control"
          name="${key}"
          value="${isMRN ? (patient[key] ?? '').toString().toUpperCase() : (patient[key] ?? '')}"
          ${key === "age" ? "readonly" : ""}
          ${isMRN ? "readonly" : ""}
          style="${isMRN ? "text-transform: uppercase;" : ""}"
        >
      </div>
    `;
  }

  html += `
    <div class="col-12 mt-3">
      <button type="button" id="btn-save-patient" class="btn btn-primary">
        Update Patient
      </button>
    </div>
  </form>`;

  target.innerHTML = html;

  // === Hitung Age otomatis saat DOB berubah ===
  const dobInput = document.querySelector('input[name="date_of_birth"]');
  const ageInput = document.querySelector('input[name="age"]');

  dobInput.addEventListener("change", () => {
    const dob = new Date(dobInput.value);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

    ageInput.value = age >= 0 ? age : 0;
  });

  // === SAVE BUTTON ===
  document.querySelector("#btn-save-patient").onclick = async () => {
    const form = document.querySelector("#patient-update-form");
    const formData = new FormData(form);
    const updated = Object.fromEntries(formData.entries());

    updated.patient_id = patient.patient_id;

    if (updated.mrn) updated.mrn = updated.mrn.toString().toUpperCase();

    console.log("📝 Update pasien:", updated);

    await window.electronAPI.updatePatient(updated);

    // SweetAlert sukses
    Swal.fire({
      icon: "success",
      title: "Updated",
      text: "Patient updated successfully.",
      confirmButtonText: "OK"
    }).then(() => {
      // Balik ke report tab
      const reportsTab = document.getElementById("reports-tab");
      if (reportsTab) reportsTab.click();
    });
  };
};

window.renderDeletePage = function (patient, procedure) {
  const wrapper = document.querySelector("#delete-info");
  if (!wrapper) return;

  wrapper.innerHTML = `
    <div class="p-3 border rounded bg-light">

      <h4 class="mb-3">Delete Confirmation</h4>

      <!-- ================= PATIENT (3 Columns) ================= -->
      <h5>Patient</h5>
      <div class="row mb-3">

        <div class="col-md-4">
          <p><b>MRN:</b> ${patient.mrn}</p>
          <p><b>Name:</b> ${patient.name}</p>
          <p><b>Date of Birth:</b> ${patient.date_of_birth}</p>
        </div>

        <div class="col-md-4">
          <p><b>Age:</b> ${patient.age}</p>
          <p><b>Sex:</b> ${patient.sex}</p>
          <p><b>Telephone:</b> ${patient.telephone}</p>
        </div>

        <div class="col-md-4">
          <p><b>Address:</b> ${patient.address}</p>
          <p><b>City:</b> ${patient.city}</p>
        </div>

      </div>

      <hr>

      <!-- ================= PROCEDURE (3 Columns) ================= -->
      <h5>Procedure</h5>
      <div class="row mb-3">

        <div class="col-md-4">
          <p><b>Procedure:</b> ${procedure.procedure}</p>
          <p><b>Doctor:</b> ${procedure.doctor_name}</p>
          <p><b>Date:</b> ${procedure.date_procedure}</p>
        </div>

        <div class="col-md-4">
          <p><b>Time:</b> ${procedure.procedure_time}</p>
          <p><b>Referring Doctor:</b> ${procedure.referring_doctor}</p>
          <p><b>Class:</b> ${procedure.class}</p>
        </div>

        <div class="col-md-4">
          <p><b>Bed:</b> ${procedure.bed}</p>
          <p><b>Complaint:</b> ${procedure.complaint}</p>
          <p><b>Diagnose:</b> ${procedure.diagnose}</p>
        </div>

      </div>

    </div>

    <!-- ================= BUTTONS OUTSIDE BOX ================= -->
    <div class="d-flex justify-content-end mt-3">
      <div class="btn-group" role="group">
        <button id="btn-delete-patient" class="btn btn-danger">Delete Patient</button>
        <button id="btn-delete-procedure" class="btn btn-warning">Delete Procedure</button>
      </div>
    </div>
  `;

  // === DELETE PATIENT ===
  document.querySelector("#btn-delete-patient").addEventListener("click", async () => {

    const result = await Swal.fire({
      title: "Delete Patient?",
      text: "This will delete the patient, ALL procedures, and the ENTIRE patient folder.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel"
    });

    if (!result.isConfirmed) return;

    // (1) DELETE DATABASE
    await window.electronAPI.deletePatient(patient.patient_id);

    // (2) DELETE PATIENT FOLDER
    // contoh relPath: "1"
    const patientFolder = window.currentDeleteFolder.split("/")[0];
    const absPatientFolder = await window.electronAPI.getFullPath(patientFolder);

    console.log("🧹 Delete Patient Folder ABS:", absPatientFolder);

    await window.electronAPI.deleteFolder(absPatientFolder);

    await Swal.fire("Deleted!", "Patient and all folders removed.", "success");

    document.getElementById("reports-tab")?.click();
  });

  // === DELETE PROCEDURE ONLY ===
  document.querySelector("#btn-delete-procedure").addEventListener("click", async () => {

    const result = await Swal.fire({
      title: "Delete Procedure?",
      text: "This action will delete ONLY this procedure and its folder.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel"
    });

    if (!result.isConfirmed) return;

    // (1) DELETE DATABASE
    await window.electronAPI.deleteProcedure(procedure.procedure_id);

    // (2) DELETE FOLDER
    const relPath = window.currentDeleteFolder;
    const absPath = await window.electronAPI.getFullPath(relPath);

    console.log("🧹 Delete Procedure Folder ABS:", absPath);

    await window.electronAPI.deleteFolder(absPath);

    await Swal.fire("Deleted!", "Procedure and folder removed.", "success");

    document.getElementById("reports-tab")?.click();
  });
};
