import { apiRequest } from "@/lib/queryClient";

export async function downloadAttachment(
    objectPath: string,
    fileName: string
) {
    // 1️⃣ Ask backend for signed download URL
    const res = await apiRequest(
        "GET",
        `/api/uploads/download?path=${encodeURIComponent(objectPath)}`
    );

    const { downloadURL } = await res.json();

    // 2️⃣ Fetch the file as a BLOB (this is the key)
    const fileResponse = await fetch(downloadURL);

    if (!fileResponse.ok) {
        throw new Error("Failed to fetch file");
    }

    const blob = await fileResponse.blob();

    // 3️⃣ Create local object URL
    const blobUrl = window.URL.createObjectURL(blob);

    // 4️⃣ Force download
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // 5️⃣ Cleanup
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
}
