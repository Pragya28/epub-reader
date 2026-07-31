import JSZip from "jszip";
import {
  EpubParseError,
  type EpubExtractionResult,
  type EpubService,
} from "./epub-types";

export class EpubServiceImpl implements EpubService {
  async extractOpf(file: Blob): Promise<EpubExtractionResult> {
    const zip = await this.loadZip(file);
    this.checkForDrm(zip);
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
    try {
      return await JSZip.loadAsync(file);
    } catch {
      throw new EpubParseError(
        "corrupted",
        "This file doesn't appear to be a valid EPUB.",
      );
    }
  }

  // ---- Step 2 ----
  private checkForDrm(zip: JSZip): void {
    if (zip.file("META-INF/encryption.xml")) {
      throw new EpubParseError(
        "drm",
        "This book is protected by DRM and can't be opened.",
      );
    }
  }

  // ---- Step 3 ----
  private async loadContainerXml(zip: JSZip): Promise<Document> {
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) {
      throw new EpubParseError(
        "unsupported",
        "This EPUB is missing required container data.",
      );
    }

    const xmlString = await containerFile.async("text");
    return this.parseXml(xmlString);
  }

  // ---- Step 4 ----
  private extractOpfPath(containerXml: Document): string {
    const rootfile = containerXml.querySelector("rootfile");
    if (!rootfile) {
      throw new EpubParseError(
        "unsupported",
        "This EPUB is missing required container data.",
      );
    }

    const opfPath = rootfile.getAttribute("full-path");
    if (!opfPath) {
      throw new EpubParseError(
        "unsupported",
        "This EPUB is missing required container data.",
      );
    }

    return opfPath;
  }

  // ---- Step 5 ----
  private async loadOpf(zip: JSZip, opfPath: string): Promise<Document> {
    const normalizedPath = opfPath.replace(/^\/+/, "");

    const opfFile = zip.file(normalizedPath);
    if (!opfFile) {
      throw new EpubParseError(
        "unsupported",
        "This EPUB is missing its package document.",
      );
    }

    const opfString = await opfFile.async("text");
    return this.parseXml(opfString);
  }

  // ---- Utility ----
  private parseXml(xml: string): Document {
    const doc = new DOMParser().parseFromString(xml, "application/xml");

    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      throw new EpubParseError("corrupted", "This EPUB's XML is malformed.");
    }

    return doc;
  }
}
