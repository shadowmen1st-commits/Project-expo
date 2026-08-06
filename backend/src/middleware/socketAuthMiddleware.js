import * as cookie from 'cookie';
const { parse } = cookie;
import { verifyAccessToken } from '../utils/authUtils.js';
import User from '../models/User.js';

export const socketAuthMiddleware = async (socket, next) => {
    try {
        let token;
        
        // 1. Check for Bearer token in handshake auth
        if (socket.handshake.auth && socket.handshake.auth.token) {
            token = socket.handshake.auth.token;
            if (token.startsWith('Bearer ')) {
                token = token.slice(7, token.length);
            }
        } 
        // 2. Check for cookie
        else if (socket.handshake.headers.cookie) {
            const cookies = parse(socket.handshake.headers.cookie);
            token = cookies.access_token;
        }

        if (!token) {
            const err = new Error('Authentication error');
            err.data = { content: 'Token required' };
            return next(err);
        }

        const decoded = verifyAccessToken(token);
        const user=await User.findById(decoded.userId||decoded.id).select('role status');
        if(!user||user.status!=='ACTIVE')throw new Error('Session user unavailable');
        socket.user = {id:String(user._id),role:user.role};
        
        next();
    } catch (error) {
        console.error('Socket Auth Error:', error);
        const err = new Error('Authentication error');
        err.data = { content: 'Invalid or expired token' };
        next(err);
    }
};

export default socketAuthMiddleware;
