function waitUntilLibrariesLoaded() {
    return new Promise(resolve => {
        const check = () => {
            if (window.jspdf && window.html2canvas) resolve();
            else setTimeout(check, 30);
        };
        check();
    });
}

// console.log("template.js VERSION TEST 123");
if (window.__template_loaded) {
    // console.log("template.js ALREADY loaded, skip init");
}
window.__template_loaded = true;
// console.log("template.js FIRST LOAD OK");

// document.querySelectorAll(".editable").forEach(ed => {
//     ed.addEventListener("keydown", (e) => {
//         if (e.key === "Enter") {
//             e.preventDefault();
//             document.execCommand("insertHTML", false, "<div><br></div>");
//         }
//     });
// });

document.querySelectorAll(".editable").forEach(ed => {
    ed.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;

        const sel = window.getSelection();
        const range = sel.getRangeAt(0);

        const node = range.startContainer;
        const containerHTML = ed.innerHTML.replace(/&nbsp;/g, '');

        // Jika 1 enter kosong sudah ada → stop
        if (containerHTML.endsWith("<br>")) {
            e.preventDefault();
            return;
        }
    });
});

function applyColonPrefix() {
    // Ambil semua input di dalam panel info pasien
    const inputs = document.querySelectorAll('.patient-info input');
    
    inputs.forEach(input => {
        // Cek apakah input ini adalah age atau dob (opsional jika dob juga tidak mau ada ":")
        if (input.id === 'patient-age') {
            return; // Lewati, jangan tambahkan apa-apa
        }

        let val = input.value.trim();
        
        // Tambahkan ": " jika belum ada
        if (val && !val.startsWith(':')) {
            input.value = ': ' + val;
        } else if (!val) {
            input.value = ': '; 
        }
    });
}

// Di dalam initTemplate Anda:
async function initTemplate() {
    await waitUntilLibrariesLoaded();
    
    // Panggil fungsi prefix
    applyColonPrefix();

    // ... sisa kode lainnya (editor, btn-save, dll)
}// }


async function initTemplate() {
    await waitUntilLibrariesLoaded();
    setTimeout(applyColonPrefix, 1000); // Terapkan setelah 1000ms

    const editor = document.getElementById("laporan-editor");
    if (editor) {
        const isOverflowing = () => {
            // Toleransi 2px untuk rendering font
            return editor.scrollHeight > (editor.clientHeight + 2);
        };

        editor.addEventListener("beforeinput", (e) => {
            if (e.inputType.startsWith("deleteContent")) return;

            if (isOverflowing()) {
                e.preventDefault();
            }
        });

        editor.addEventListener("keydown", (e) => {
            // Cegah Enter jika sudah mepet bawah
            if (e.key === "Enter" && isOverflowing()) {
                e.preventDefault();
            }
        });

        editor.addEventListener("input", () => {
            if (isOverflowing()) {
                // Jika terlanjur masuk, paksa undo
                document.execCommand('undo', false, null);

                Swal.fire({
                    title: "Kapasitas Penuh",
                    text: "Isi laporan tidak muat lagi di halaman ini.",
                    icon: "warning",
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    }

    const btnSave = document.getElementById("btn-save");
    if (!btnSave) return;

    // Hapus listener lama jika ada (mencegah double trigger)
    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);

    newBtnSave.addEventListener("click", async () => {
        // 1. Tanya dulu (SWAL)
        const result = await Swal.fire({
            title: "Simpan Laporan?",
            text: "File PDF akan diperbarui.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Simpan!",
            cancelButtonText: "Batal",
        });

        // Jika user klik Batal, langsung stop.
        if (!result.isConfirmed) return;

        // 2. Tampilkan Spinner
        const spinner = document.getElementById("spinner-overlay");
        if (spinner) spinner.style.display = "flex";

        // 3. JEDA SEDIKIT (Penting agar spinner sempat muncul sebelum browser sibuk)
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
            const reportPage = document.getElementById("report-page");

            // 4. Proses html2canvas
            const canvas = await html2canvas(reportPage, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false
            });

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF("p", "pt", "a4");
            const imgData = canvas.toDataURL("image/png");

            const pdfWidth = 595.28;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);

            const pdfBase64 = pdf.output("datauristring").split(",")[1];
            const folder = window.currentReportFolder;

            await window.electronAPI.saveFileToFolder({
                folderPath: folder,
                fileName: "laporan.pdf",
                data: pdfBase64,
                type: "base64"
            });

            // 5. Matikan Spinner SEBELUM muncul Swal Sukses
            if (spinner) spinner.style.display = "none";

            // 6. Swal Sukses
            await Swal.fire({
                title: "Berhasil!",
                text: "PDF telah diperbarui.",
                icon: "success",
                timer: 3000,
                showConfirmButton: false
            });

            // Balik ke menu utama
            const reportsTab = document.getElementById("reports-tab");
            if (reportsTab) reportsTab.click();

        } catch (err) {
            if (spinner) spinner.style.display = "none";
            console.error("ERROR:", err);
            Swal.fire("Error", "Gagal: " + err.message, "error");
        }
    });

    // Logika pembatasan baris Kop Detail
    const kopDetail = document.querySelector(".kop-detail");
    if (kopDetail) {
        kopDetail.addEventListener("input", () => {
            const lines = kopDetail.innerText.split("\n");
            if (lines.length > 3) {
                kopDetail.innerText = lines.slice(0, 3).join("\n");
            }
        });
    }
}