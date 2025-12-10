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

async function initTemplate() {
    // console.log("INIT TEMPLATE RUNNING!");
    await waitUntilLibrariesLoaded();

    const editor = document.getElementById("laporan-editor");
    if (editor) {
        editor.addEventListener("beforeinput", (e) => {
            if (e.inputType.startsWith("delete")) return;

            const maxHeight = editor.clientHeight;
            const currentHeight = editor.scrollHeight;
            if (currentHeight > maxHeight) e.preventDefault();
        });
    }

    const { jsPDF } = window.jspdf;
    const btnSave = document.getElementById("btn-save");
    const reportPage = document.getElementById("report-page");
    const photoArea = document.getElementById("photo-area");
    const kopDetail = document.querySelector(".kop-detail");
    // console.log("btn-save exists?", !!btnSave);
    // console.log("found btn:", btnSave);
    // Batasi 3 baris
    if (kopDetail) {
        kopDetail.addEventListener("input", () => {
            const lines = kopDetail.innerText.split("\n");
            if (lines.length > 3) {
                kopDetail.innerText = lines.slice(0, 3).join("\n");
            }
        });
    }

    // EVENT SAVE PDF
    btnSave.addEventListener("click", async () => {
        console.log("EXPORT KLIK");

        const spinner = document.getElementById("spinner-overlay");
        if (spinner) spinner.style.display = "flex"; // tampilkan spinner

        try {
            const canvas = await html2canvas(reportPage, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
            });

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

            // Pindah ke reports tab
            const reportsTab = document.getElementById("reports-tab");
            if (reportsTab) reportsTab.click();

        } catch (err) {
            console.error("ERROR:", err);
        } finally {
            // Sembunyikan spinner
            if (spinner) spinner.style.display = "none";
        }
    });
}