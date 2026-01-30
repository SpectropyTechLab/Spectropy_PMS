import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // backend only
);

export class SupabaseStorageService {
    bucket = "uploads";

    /**
     * Generate a signed upload URL (PUT)
     */
    async getSignedUploadUrl(params: {
        userId: number;
        fileName: string;
        contentType: string;
        folder?: string;
    }) {
        const { userId, fileName, folder } = params;
        const safeFolder = (folder || "projects").replace(/[^a-zA-Z0-9_-]/g, "");
        const normalizedFolder = safeFolder.length > 0 ? safeFolder : "projects";
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");

        const objectPath = `${normalizedFolder}/${userId}/${Date.now()}-${safeFileName}`;

        const { data, error } = await supabase.storage
            .from(this.bucket)
            .createSignedUploadUrl(objectPath);

        if (error || !data) {
            throw new Error("Failed to generate Supabase upload URL");
        }

        return {
            uploadURL: data.signedUrl,
            objectPath,
        };
    }

    /**
     * Generate a signed download URL (GET)
     */
    async getSignedDownloadUrl(objectPath: string, ttlSec = 3600) {
        const { data, error } = await supabase.storage
            .from(this.bucket)
            .createSignedUrl(objectPath, ttlSec);

        if (error || !data) {
            throw new Error("Failed to generate download URL");
        }

        return data.signedUrl;
    }

    /**
     * Delete file
     */
    async deleteObject(objectPath: string) {
        const { error } = await supabase.storage
            .from(this.bucket)
            .remove([objectPath]);

        if (error) {
            throw new Error("Failed to delete object");
        }
    }
}
