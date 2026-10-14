// Bóveda de documentos local y sincronización con el Launcher de CoffeWorks
import type { DocumentMetadata } from "../types";

const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

export interface StoredLauncherDoc {
  id: string;
  name: string;
  app_id: string;
  category: string;
  last_modified: string;
  is_pinned: boolean;
  path: string;
}

export const documentVault = {
  // Cargar documento actual desde almacenamiento
  loadCurrentDocument(): { metadata: DocumentMetadata; content: string } {
    if (typeof window === "undefined") {
      return {
        metadata: {
          id: "doc_default",
          title: "Documento sin título",
          author: "Usuario CoffeWorks",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        content: "<h1>Documento de Trabajo</h1><p>Comienza a escribir aquí tu contenido con formato enriquecido...</p>",
      };
    }

    try {
      const savedDoc = localStorage.getItem("coffedoc_active_document");
      if (savedDoc) {
        return JSON.parse(savedDoc);
      }
    } catch (e) {
      console.warn("No se pudo cargar documento guardado:", e);
    }

    const initial = {
      metadata: {
        id: `doc_${Date.now()}`,
        title: "Nuevo Documento",
        author: "Usuario CoffeWorks",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      content: "<h1>Documento de Trabajo</h1><p>Comienza a redactar tu contenido con CoffeDoc. Puedes aplicar estilos de título, negrita, listas, citas y tablas desde la cinta superior.</p>",
    };

    return initial;
  },

  // Guardar documento y sincronizar con la bóveda del Launcher
  async saveDocument(metadata: DocumentMetadata, content: string): Promise<void> {
    if (typeof window === "undefined") return;

    const docPayload = {
      metadata: {
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
      content,
    };

    // 1. Guardar documento activo en CoffeDoc
    try {
      localStorage.setItem("coffedoc_active_document", JSON.stringify(docPayload));
    } catch (err) {
      console.error("Error al guardar en almacenamiento local:", err);
    }

    // 2. Sincronizar con la lista de documentos recientes del Launcher
    try {
      const rawLauncherDocs = localStorage.getItem("coffeeworks_recent_docs");
      let launcherDocs: StoredLauncherDoc[] = rawLauncherDocs ? JSON.parse(rawLauncherDocs) : [];

      const docName = metadata.title.trim().endsWith(".cfd")
        ? metadata.title.trim()
        : `${metadata.title.trim() || "Sin título"}.cfd`;

      const existingIndex = launcherDocs.findIndex((d) => d.id === metadata.id);

      const entry: StoredLauncherDoc = {
        id: metadata.id,
        name: docName,
        app_id: "coffedoc",
        category: "Producto",
        last_modified: "Editado hace un momento",
        is_pinned: existingIndex >= 0 ? launcherDocs[existingIndex].is_pinned : false,
        path: `./vault/${docName}`,
      };

      if (existingIndex >= 0) {
        launcherDocs[existingIndex] = entry;
      } else {
        launcherDocs.unshift(entry);
      }

      localStorage.setItem("coffeeworks_recent_docs", JSON.stringify(launcherDocs));

      // Sincronizar vía endpoint con el Launcher en localhost:1420
      fetch("http://localhost:1420/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }).catch(() => {
        // Ignorar silenciosamente si el launcher no está accesible
      });
    } catch (err) {
      console.error("Error al sincronizar con el Launcher:", err);
    }

    // 3. Si se ejecuta en Tauri, guardar archivo físico en disco
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const docName = `${metadata.title.trim() || "Sin_titulo"}.cfd`;
        await invoke("save_document_file", {
          path: `./vault/${docName}`,
          content: JSON.stringify(docPayload, null, 2),
        });
      } catch (err) {
        console.warn("Fallo al guardar en Tauri:", err);
      }
    }
  },

  // Exportar a archivo descargable según formato
  exportFile(metadata: DocumentMetadata, content: string, format: "cfd" | "md" | "html" | "docx"): void {
    const filename = `${metadata.title || "documento"}.${format}`;
    let output: BlobPart = "";
    let mimeType = "text/plain";

    if (format === "cfd") {
      output = JSON.stringify({ metadata, content }, null, 2);
      mimeType = "application/json";
    } else if (format === "docx") {
      // Documento HTML estructurado compatible con Microsoft Word
      output = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${metadata.title}</title>
        <!--[if gte mso 9]>
        <xml>
        <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Calibri', 'Segoe UI', sans-serif; font-size: 11pt; line-height: 1.5; color: #111111; margin: 1in; }
          h1 { font-size: 18pt; color: #185abd; font-weight: bold; }
          h2 { font-size: 14pt; color: #2b579a; font-weight: bold; }
          h3 { font-size: 12pt; color: #333333; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
          th, td { border: 1pt solid #d2d0ce; padding: 6pt; text-align: left; }
        </style>
        </head>
        <body>${content}</body>
        </html>
      `;
      mimeType = "application/vnd.ms-word";
    } else if (format === "html") {
      output = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${metadata.title}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;line-height:1.6;padding:0 20px;color:#222;}</style></head><body>${content}</body></html>`;
      mimeType = "text/html";
    } else if (format === "md") {
      // Conversión ligera de HTML a Markdown
      output = content
        .replace(/<h1>(.*?)<\/h1>/gi, "# $1\n\n")
        .replace(/<h2>(.*?)<\/h2>/gi, "## $1\n\n")
        .replace(/<h3>(.*?)<\/h3>/gi, "### $1\n\n")
        .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
        .replace(/<b>(.*?)<\/b>/gi, "**$1**")
        .replace(/<em>(.*?)<\/em>/gi, "*$1*")
        .replace(/<i>(.*?)<\/i>/gi, "*$1*")
        .replace(/<code>(.*?)<\/code>/gi, "`$1`")
        .replace(/<p>(.*?)<\/p>/gi, "$1\n\n")
        .replace(/<br\s*[\/]?>/gi, "\n")
        .replace(/<[^>]+>/g, "");
      mimeType = "text/markdown";
    }

    const blob = new Blob([output], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  // Importar archivo de Word (.docx), texto (.txt, .md), HTML (.html) o nativo (.cfd)
  async importDocumentFile(file: File): Promise<{ content: string; title: string }> {
    const title = file.name.replace(/\.[^/.]+$/, "");
    const lowerName = file.name.toLowerCase();

    // 1. Si es archivo .docx
    if (lowerName.endsWith(".docx")) {
      try {
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        // Verificar si es un archivo ZIP binario (PKZip estándar para Word .docx: firmas 0x50, 0x4B)
        const isZip = uint8.length >= 4 && uint8[0] === 0x50 && uint8[1] === 0x4b;

        if (isZip) {
          try {
            const mammoth = await import("mammoth");
            const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
            if (result.value && result.value.trim().length > 0) {
              return { content: result.value, title };
            }
          } catch (mammothErr) {
            console.warn("Fallo en conversor Mammoth, usando fallback a texto/HTML:", mammothErr);
          }
        }

        // Si no es un ZIP o Mammoth falló, decodificar como texto (p.ej. exportado por CoffeDoc en HTML)
        const text = new TextDecoder("utf-8").decode(buffer);
        if (text.includes("<html") || text.includes("<body") || text.includes("<p") || text.includes("<div") || text.includes("<table")) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, "text/html");
          const bodyHtml = doc.body ? doc.body.innerHTML : text;
          if (bodyHtml && bodyHtml.trim().length > 0) {
            return { content: bodyHtml, title };
          }
        }

        // Si es texto plano dentro de un contenedor .docx
        if (text.trim().length > 0) {
          const formatted = text
            .split(/\r?\n\r?\n/)
            .map((para) => `<p>${para.replace(/\r?\n/g, "<br/>")}</p>`)
            .join("");
          return { content: formatted, title };
        }
      } catch (err) {
        console.error("Error al procesar archivo .docx:", err);
      }
    }

    // 2. Si es archivo nativo .cfd o .json
    if (lowerName.endsWith(".cfd") || lowerName.endsWith(".json")) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed.content) {
          return { content: parsed.content, title: parsed.metadata?.title || title };
        }
      } catch {
        // Fallback a texto plano
      }
    }

    // 3. Si es archivo .html o .htm
    if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
      try {
        const text = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        return { content: doc.body ? doc.body.innerHTML : text, title };
      } catch {
        // Fallback a texto
      }
    }

    // 4. Si es Markdown (.md)
    if (lowerName.endsWith(".md")) {
      const rawText = await file.text();
      const html = rawText
        .replace(/^### (.*$)/gim, "<h3>$1</h3>")
        .replace(/^## (.*$)/gim, "<h2>$1</h2>")
        .replace(/^# (.*$)/gim, "<h1>$1</h1>")
        .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/gim, "<em>$1</em>")
        .split(/\r?\n\r?\n/)
        .map((p) => (p.startsWith("<h") ? p : `<p>${p.replace(/\r?\n/g, "<br/>")}</p>`))
        .join("");
      return { content: html, title };
    }

    // 5. Fallback general a texto plano
    const rawText = await file.text();
    const formattedHtml = rawText
      .split(/\r?\n\r?\n/)
      .map((para) => `<p>${para.replace(/\r?\n/g, "<br/>")}</p>`)
      .join("");

    return { content: formattedHtml, title };
  },
};
