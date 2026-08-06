import mongoose from 'mongoose';
import { config } from '../config/env.js';
import VerificationDocument from '../models/VerificationDocument.js';

const repair = process.argv.includes('--repair');
if (config.NODE_ENV === 'production' && repair) {
    throw new Error('Unsafe production document auto-repair is refused. Audit and repair duplicates manually.');
}

await mongoose.connect(config.MONGODB_URI);
let duplicateGroups = 0;
let recordsRepaired = 0;
let aliasesMigrated = 0;
let droppedIndexes = 0;

try {
    const collection = VerificationDocument.collection;
    const indexes = await collection.indexes();
    const duplicateCurrent = await VerificationDocument.aggregate([
        { $match: { isCurrent: true } },
        { $group: { _id: { workerId: '$workerId', documentType: '$documentType' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } }
    ]);
    duplicateGroups = duplicateCurrent.length;

    const aliasCount = await VerificationDocument.countDocuments({ documentType: 'DRIVING_LICENCE' });
    if ((duplicateGroups || aliasCount) && !repair) {
        console.log(`DOCUMENT_INDEX_AUDIT duplicateCurrentGroups=${duplicateGroups} legacyAliases=${aliasCount} repairRequired=true`);
        process.exitCode = 2;
    } else {
        if (repair) {
            for (const group of duplicateCurrent) {
                const records = await VerificationDocument.find({ _id: { $in: group.ids } }).sort({ uploadedAt: -1, createdAt: -1, _id: -1 });
                const keep = records.find(record => record.frontFileId && record.fileMimeType) || records[0];
                const result = await VerificationDocument.updateMany({ _id: { $in: group.ids.filter(id => !id.equals(keep._id)) } }, { $set: { isCurrent: false } });
                recordsRepaired += result.modifiedCount;
            }
            const aliasResult = await collection.updateMany({ documentType: 'DRIVING_LICENCE' }, { $set: { documentType: 'DRIVING_LICENSE' } });
            aliasesMigrated = aliasResult.modifiedCount;
        }

        for (const index of indexes) {
            const wrongWorkerTypeUnique = index.unique && index.key?.workerId === 1 && index.key?.documentType === 1 && !index.partialFilterExpression;
            const obsoleteCurrentIndex = index.name === 'workerId_1_documentType_1_isCurrent_1';
            if (wrongWorkerTypeUnique || obsoleteCurrentIndex) {
                await collection.dropIndex(index.name);
                droppedIndexes++;
            }
        }
        await collection.createIndex(
            { workerId: 1, documentType: 1 },
            { unique: true, partialFilterExpression: { isCurrent: true }, name: 'unique_current_worker_document' }
        );
        await collection.createIndex(
            { workerId: 1, operationId: 1 },
            { unique: true, partialFilterExpression: { operationId: { $type: 'string' } }, name: 'unique_worker_document_operation' }
        );
        console.log(`DOCUMENT_INDEX_MIGRATION duplicateCurrentGroups=${duplicateGroups} recordsRepaired=${recordsRepaired} aliasesMigrated=${aliasesMigrated} droppedIndexes=${droppedIndexes}`);
    }
} finally {
    await mongoose.disconnect();
}
