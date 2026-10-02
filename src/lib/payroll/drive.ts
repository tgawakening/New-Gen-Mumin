import "server-only";
import { randomUUID } from "crypto";
import { driveRequest, driveUpload } from "@/lib/google-drive/client";
import type { PayrollProof } from "./calculation";
export function payrollFolderId(value: string) {
 const trimmed = value.trim();
 const id = trimmed.match(/^https:\/\/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)(?:[?#].*)?$/)?.[1] ?? trimmed;
 if (!/^[A-Za-z0-9_-]{10,160}$/.test(id)) throw new Error("Enter the teacher's Google Drive payroll folder link or ID.");
 return id;
}
export async function verifyPayrollFolder(id: string) {
 const folder = await driveRequest<{id:string;mimeType:string;trashed?:boolean;capabilities?:{canAddChildren?:boolean};permissions?:Array<{type:string}>}>("/files/" + id + "?supportsAllDrives=true&fields=id,mimeType,trashed,capabilities(canAddChildren),permissions(type)");
 if (folder.trashed || folder.mimeType !== "application/vnd.google-apps.folder" || !folder.capabilities?.canAddChildren) throw new Error("The app cannot upload to that folder. Check the payroll folder access.");
 if (folder.permissions?.some(p=>p.type === "anyone" || p.type === "domain")) throw new Error("Use a private teacher payroll folder, without public or whole-domain access.");
}
export async function uploadPayrollProof(file: File, folderId: string, teacherName: string, month: string, paidOn: string): Promise<PayrollProof> {
 if (file.size === 0 || file.size > 8 * 1024 * 1024) throw new Error("Payment evidence must be no larger than 8 MB.");
 const bytes = Buffer.from(await file.arrayBuffer());
 const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
 const webp = bytes.subarray(0,4).toString()==="RIFF" && bytes.subarray(8,12).toString()==="WEBP";
 const pdf = bytes.subarray(0,5).toString()==="%PDF-";
 const mimeType = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : pdf ? "application/pdf" : "";
 if (!mimeType || file.type !== mimeType) throw new Error("Upload a PNG, JPG, WebP image or PDF payment receipt.");
 await verifyPayrollFolder(folderId);
 const extension = png?"png":jpeg?"jpg":webp?"webp":"pdf";
 const name = (teacherName.replace(/[^a-zA-Z0-9 -]/g, "").slice(0,80) || "Teacher") + " - " + month + " payroll - paid " + (paidOn || "date-pending") + " - " + randomUUID().slice(0,8) + "." + extension;
 const caption = teacherName + " | " + month + " payroll payment evidence | Payment date: " + (paidOn || "to be confirmed");
 const boundary = "payroll-" + randomUUID();
 const body = Buffer.concat([Buffer.from("--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+JSON.stringify({name,description:caption,parents:[folderId]})+"\r\n"),Buffer.from("--"+boundary+"\r\nContent-Type: "+mimeType+"\r\n\r\n"),bytes,Buffer.from("\r\n--"+boundary+"--")]);
 const uploaded = await driveUpload<{id:string}>("/files?uploadType=multipart&supportsAllDrives=true&fields=id", {method:"POST",headers:{"Content-Type":"multipart/related; boundary="+boundary},body});
 return {fileId:uploaded.id,name,mimeType,caption};
}
