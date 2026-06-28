import JSZip from "jszip";
import { type EpubExtractionResult, type EpubService } from "./epub-types";

export class EpubServiceImpl implements EpubService {
  async extractOpf(file: Blob): Promise<EpubExtractionResult> {
    const zip = await this.loadZip(file);
    const containerXml = await this.loadContainerXml(zip);
    const opfPath = this.extractOpfPath(containerXml);
    const opfXml = await this.loadOpf(zip, opfPath);

    return {
      zip,
      opfPath,
      opfXml,
    };
  }

  // ---- Step 1 ----
  private async loadZip(file: Blob): Promise<JSZip> {
    return JSZip.loadAsync(file);
  }

  // ---- Step 2 ----
  private async loadContainerXml(zip: JSZip): Promise<Document> {
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) throw new Error("container.xml not found");

    const xmlString = await containerFile.async("text");
    return this.parseXml(xmlString);
  }

  // ---- Step 3 ----
  private extractOpfPath(containerXml: Document): string {
    const rootfile = containerXml.querySelector("rootfile");
    if (!rootfile) throw new Error("rootfile not found in container.xml");

    const opfPath = rootfile.getAttribute("full-path");
    if (!opfPath) throw new Error("full-path attribute missing on rootfile");

    return opfPath;
  }

  // ---- Step 4 ----
  private async loadOpf(zip: JSZip, opfPath: string): Promise<Document> {
    const normalizedPath = opfPath.replace(/^\/+/, "");

    const opfFile = zip.file(normalizedPath);
    if (!opfFile) throw new Error(`OPF file not found at path: ${opfPath}`);

    const opfString = await opfFile.async("text");
    return this.parseXml(opfString);
  }

  // ---- Utility ----
  private parseXml(xml: string): Document {
    const doc = new DOMParser().parseFromString(xml, "application/xml");

    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      throw new Error("Invalid XML");
    }

    return doc;
  }
}
