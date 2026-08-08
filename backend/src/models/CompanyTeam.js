import { Schema, model } from 'mongoose';

const companyTeamSchema = new Schema(
    {
        companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true, trim: true },
        leaderId: { type: Schema.Types.ObjectId, ref: 'User' }, // Hired worker as lead
        members: [{ type: Schema.Types.ObjectId, ref: 'User' }]
    },
    {
        timestamps: true
    }
);

export const CompanyTeam = model('CompanyTeam', companyTeamSchema);
export default CompanyTeam;
