import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema({
    announcementText: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

// Avoid compiling the model multiple times during dev hot-reloads
export default mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);