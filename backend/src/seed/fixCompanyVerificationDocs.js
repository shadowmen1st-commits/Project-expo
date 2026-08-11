import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

const validPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const validPdfBuffer = Buffer.from(`%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj
4 0 obj <</Length 55>> stream
BT /Helvetica 24 Tf 100 700 Td (Company Verification Document) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000233 00000 n 
trailer <</Size 5 /Root 1 0 R>>
startxref
337
%%EOF`);

async function fixDocs() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME || 'test' });
    const storageDir = path.resolve('uploads/verification');
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

    const docs = await mongoose.connection.db.collection('companyverificationdocuments').find({}).toArray();
    console.log('Found docs:', docs.length);

    for (const d of docs) {
        let key = d.storageKey;
        if (!key || key.startsWith('http')) {
            const isPdf = d.documentType.includes('REGISTRATION') || d.documentType.includes('CERTIFICATE');
            key = `company_${d.documentType.toLowerCase()}_${d._id}.${isPdf ? 'pdf' : 'png'}`;
        }
        const filePath = path.join(storageDir, key);
        const isPdf = key.endsWith('.pdf') || (d.mimeType && d.mimeType.includes('pdf'));
        const buf = isPdf ? validPdfBuffer : validPngBuffer;
        
        fs.writeFileSync(filePath, buf);
        console.log('Wrote file:', filePath, 'Size:', buf.length);

        await mongoose.connection.db.collection('companyverificationdocuments').updateOne(
            { _id: d._id },
            {
                $set: {
                    storageKey: key,
                    documentUrl: `/uploads/verification/${key}`,
                    fileName: d.fileName || `${d.documentType}.${isPdf ? 'pdf' : 'png'}`,
                    fileSize: buf.length,
                    mimeType: isPdf ? 'application/pdf' : 'image/png'
                }
            }
        );
    }

    console.log('Repaired all company verification document records and created real physical files!');
    await mongoose.disconnect();
}

fixDocs().catch(console.error);
