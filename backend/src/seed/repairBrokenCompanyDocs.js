import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

async function repairBrokenCompanyDocs() {
    console.log('=== Starting Company Verification Document Integrity Check & Repair ===');
    const testDbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
    await mongoose.connect(testDbUri, { dbName: process.env.DB_NAME || 'test' });

    const storageDir = path.resolve('uploads/verification');
    const docs = await mongoose.connection.db.collection('companyverificationdocuments').find({}).toArray();
    console.log(`Total Company Verification Documents in MongoDB: ${docs.length}`);

    let validCount = 0;
    let repairedCount = 0;

    for (const d of docs) {
        let isBroken = false;
        let reason = '';

        if (!d.storageKey && !d.documentUrl) {
            isBroken = true;
            reason = 'Missing storage key and document URL.';
        } else {
            const key = d.storageKey || path.basename(d.documentUrl);
            const filePath = path.join(storageDir, key);

            if (d.documentUrl && /^https?:\/\//i.test(d.documentUrl)) {
                // Remote URL
                validCount++;
                continue;
            }

            if (!fs.existsSync(filePath)) {
                isBroken = true;
                reason = `File does not exist on disk at path: ${filePath}`;
            } else {
                const stat = fs.statSync(filePath);
                if (stat.size === 0) {
                    isBroken = true;
                    reason = `File on disk is 0 bytes at path: ${filePath}`;
                }
            }
        }

        if (isBroken) {
            console.log(`[BROKEN DOCUMENT FOUND] ID: ${d._id} | Type: ${d.documentType} | Reason: ${reason}`);
            await mongoose.connection.db.collection('companyverificationdocuments').updateOne(
                { _id: d._id },
                {
                    $set: {
                        status: 'REJECTED',
                        rejectionReason: 'Document file content is missing or unreadable on storage. Please re-upload this document.',
                        updatedAt: new Date()
                    }
                }
            );
            repairedCount++;
        } else {
            validCount++;
        }
    }

    console.log(`\n=== Repair Audit Summary ===`);
    console.log(`Valid Documents Intact: ${validCount}`);
    console.log(`Broken Documents Marked as REJECTED for Re-upload: ${repairedCount}`);
    await mongoose.disconnect();
}

repairBrokenCompanyDocs().catch(console.error);
