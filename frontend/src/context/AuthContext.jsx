import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../config/api';
const AuthContext=createContext(undefined);
export const AuthProvider=({children})=>{
 const [user,setUser]=useState(null);const [loading,setLoading]=useState(true);
 const restoreSession=useCallback(async()=>{try{const response=await api.get('/auth/me');setUser(response.data.user);}catch{setUser(null);}finally{setLoading(false);}},[]);
 useEffect(()=>{restoreSession();const expired=()=>setUser(null);window.addEventListener('auth:expired',expired);return()=>window.removeEventListener('auth:expired',expired);},[restoreSession]);
  const login=async(email,password)=>{setLoading(true);try{const response=await api.post('/auth/login',{email:email.trim().toLowerCase(),password});if(response.data.accessToken)localStorage.setItem('accessToken',response.data.accessToken);setUser(response.data.user);return response.data.user;}finally{setLoading(false);}};
  const registerUser=async data=>{
    const finalUrl = `${api.defaults.baseURL || ''}/auth/register`;
    console.log("REGISTER REQUEST START:", { url: finalUrl, payload: { ...data, password: '***' } });
    try {
        const response = await api.post('/auth/register',{...data,email:data.email.trim().toLowerCase()});
        console.log("REGISTER RESPONSE SUCCESS:", response.data);
        return response.data.user;
    } catch (err) {
        console.error("REGISTER REQUEST FAILED:", err.response?.data || err.message);
        throw err;
    }
  };
  const logout=async()=>{try{await api.post('/auth/logout');}finally{localStorage.removeItem('accessToken');setUser(null);}};
  const updateUser = (data) => setUser(prev => prev ? { ...prev, ...data } : data);
  return <AuthContext.Provider value={{user,setUser,updateUser,token:null,loading,login,registerUser,logout,restoreSession}}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used within an AuthProvider');return value;};
export default AuthContext;
