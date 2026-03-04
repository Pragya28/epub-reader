import JSZip from "jszip";

export async function parseContainerXml(zip: JSZip): Promise<string> {
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("container.xml not found");

  const xmlString = await containerFile.async("string");
  const doc = new DOMParser().parseFromString(xmlString, "application/xml");

  const rootfile = doc.querySelector("rootfile");
  if (!rootfile) throw new Error("rootfile not found in container.xml");

  const opfPath = rootfile.getAttribute("full-path");
  if (!opfPath) throw new Error("full-path attribute missing on rootfile");

  return opfPath;
}
