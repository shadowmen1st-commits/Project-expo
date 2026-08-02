import mongoose from 'mongoose';
import config from '../config/env.js';
import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
import { hashPassword } from './authUtils.js';

const accounts=[
 {name:'Super Admin',email:'admin@hyperlocal.com',phone:'9999999999',password:'admin123',role:'ADMIN'},
 {name:'John Customer',email:'customer@hyperlocal.com',phone:'8888888888',password:'customer123',role:'CUSTOMER'},
 {name:'Alice Worker',email:'worker@hyperlocal.com',phone:'7777777777',password:'worker123',role:'WORKER'},
];
try{
 await mongoose.connect(config.MONGODB_URI);
 for(const account of accounts){const passwordHash=await hashPassword(account.password);const user=await User.findOneAndUpdate({email:account.email},{$set:{name:account.name,phone:account.phone,passwordHash,role:account.role,status:'ACTIVE',emailVerified:true,phoneVerified:true}},{upsert:true,new:true,setDefaultsOnInsert:true});if(account.role==='WORKER')await WorkerProfile.findOneAndUpdate({userId:user._id},{$set:{verificationStatus:'APPROVED',verificationBadge:true,isPubliclyVisible:true,isOnline:true}},{upsert:true,setDefaultsOnInsert:true});console.log(`AUTH_SEED_OK=${account.email} ROLE=${account.role}`);}
}finally{await mongoose.disconnect();}
