// PDF-to-Word Converter React Component (fixed Packer toBuffer issue)
import React, { useState, useRef } from "react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import { motion } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import "tailwindcss/tailwind.css";

(function setPdfWorker() {
  try {
    const ver = (pdfjsLib && pdfjsLib.version) ? pdfjsLib.version : null;
    if (ver) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${ver}/build/pdf.worker.min.js`;
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';
    }
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';
  }
})();

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}
function groupTextItemsByLine(items) {
  if (!items || !items.length) return [];
  const lines = [];
  items.forEach(item => {
    const transform = item.transform || [];
    const y = transform.length >= 6 ? Math.round(transform[5]) : 0;
    const text = item.str || '';
    let found = false;
    for (let l of lines) {
      if (Math.abs(l.y - y) < 4) {
        l.items.push({ x: transform[4] || 0, text });
        found = true; break;
      }
    }
    if (!found) lines.push({ y, items: [{ x: transform[4] || 0, text }] });
  });
  lines.sort((a, b) => b.y - a.y);
  return lines.map(l => l.items.sort((a, b) => a.x - b.x).map(i => i.text));
}

function FeatureCard({ title, desc }) {
  return (
    <motion.div whileHover={{ y: -6 }} className="p-4 rounded-xl bg-white/4 border border-white/6">
      <h3 className="text-white font-medium">{title}</h3>
      <p className="text-slate-300 text-sm mt-1">{desc}</p>
    </motion.div>
  );
}

export default function App() {
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setMessage("");
  }

  async function convert() {
    const file = (fileInputRef.current && fileInputRef.current.files[0]);
    if (!file) {
      setMessage("请先上传 PDF 文件。");
      return;
    }
    setBusy(true);
    setProgress(0);
    setMessage("开始解析 PDF...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      const doc = new Document({ sections: [] });
      const sectionChildren = [];

      for (let i = 1; i <= numPages; i++) {
        setProgress(Math.round(((i - 1) / numPages) * 100));
        setMessage(`正在处理第 ${i} 页 / ${numPages} ...`);
        const page = await pdf.getPage(i);

        const textContent = await page.getTextContent();
        const grouped = groupTextItemsByLine(textContent.items);
        grouped.forEach(line => {
          const paragraph = new Paragraph({ children: [new TextRun(line.join(''))] });
          sectionChildren.push(paragraph);
        });

        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const arrayBuf = await blob.arrayBuffer();
        const image = new ImageRun({ data: arrayBuf, transformation: { width: 600, height: Math.round((600 * viewport.height) / viewport.width) } });
        sectionChildren.push(new Paragraph({ children: [image] }));
        sectionChildren.push(new Paragraph({ children: [new TextRun({ text: '--- Page Break ---', italics: true })] }));
      }

      doc.addSection({ children: sectionChildren });
      setMessage('正在生成 Word 文档...');

      // Use Packer.toBlob instead of toBuffer for browser
      const blobOut = await Packer.toBlob(doc);
      const outName = sanitizeFileName(fileName.replace(/\.pdf$/i, '') || 'converted') + '.docx';
      saveAs(blobOut, outName);

      setProgress(100);
      setMessage('转换完成 — 已下载 .docx 文件');
    } catch (err) {
      console.error(err);
      setMessage('转换失败：' + (err && err.message ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-3xl w-full bg-white/5 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/10">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">PDF → Word 转换器</h1>
            <p className="text-sm text-slate-300">客户端转换，可编辑的 .docx，隐私友好（文件不上传）。</p>
          </div>
          <div className="text-slate-300 text-sm">可部署于 Cloudflare Pages</div>
        </header>

        <main>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2">
              <label className="block text-slate-300 text-sm mb-2">上传 PDF 文件</label>
              <div className="flex gap-2">
                <input ref={fileInputRef} onChange={handleFile} type="file" accept="application/pdf" className="hidden" id="fileInput" />
                <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="px-4 py-2 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-white transition">选择文件</button>
                <div className="flex-1 text-sm text-slate-200 py-2 px-3 bg-white/3 rounded-xl">{fileName || '尚未选择文件'}</div>
              </div>
            </div>
            <div className="flex gap-2 justify-end md:justify-center">
              <button onClick={convert} disabled={busy} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg disabled:opacity-50 transition">开始转换</button>
            </div>
          </div>

          <div className="mt-6">
            <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
              <div style={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"></div>
            </div>
            <div className="mt-2 text-sm text-slate-300">{message || '等待操作...'}</div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard title="可编辑文本" desc="使用 PDF.js 提取文本并生成可编辑段落（非仅图片）。适用于大多数文字型 PDF。" />
            <FeatureCard title="布局与图片回退" desc="对复杂布局或图像密集的页面，会附加渲染的页面图片作为回退，保留原始视觉信息。" />
          </div>

          <footer className="mt-6 text-xs text-slate-400">提示：若需最高保真度（复杂表格/布局），请考虑服务端转换（LibreOffice/商用 API）。</footer>
        </main>
      </motion.div>
    </div>
  );
}
