package com.darshan.fitness
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object Store {
 private fun prefs(c:Context)=c.getSharedPreferences("fitness_private",0)
 private fun key():SecretKey {val ks=KeyStore.getInstance("AndroidKeyStore").apply{load(null)};return (ks.getKey("fitness_auth",null) as? SecretKey)?:KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply{init(KeyGenParameterSpec.Builder("fitness_auth",KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())}.generateKey()}
 @Synchronized fun setSession(c:Context,token:String,user:String){require(token.matches(Regex("[a-f0-9]{64}")));val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.ENCRYPT_MODE,key())};val raw=JSONObject().put("token",token).put("user",user).toString().toByteArray();prefs(c).edit().putString("auth",Base64.encodeToString(cipher.iv+cipher.doFinal(raw),Base64.NO_WRAP)).commit()}
 @Synchronized fun auth(c:Context):JSONObject? {return try{val raw=Base64.decode(prefs(c).getString("auth",null)?:return null,Base64.NO_WRAP);val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,raw.copyOfRange(0,12)))};JSONObject(String(cipher.doFinal(raw.copyOfRange(12,raw.size))))}catch(e:Exception){null}}
 @Synchronized fun clearSession(c:Context){prefs(c).edit().remove("auth").commit()}
 @Synchronized fun trackingEnabled(c:Context):Boolean {val scope=scope(c)?:return true;return prefs(c).getBoolean("tracking_"+scope,true)}
 @Synchronized fun setTrackingEnabled(c:Context,enabled:Boolean){val scope=scope(c)?:return;prefs(c).edit().putBoolean("tracking_"+scope,enabled).commit()}
 fun scopeFor(user:String):String=MessageDigest.getInstance("SHA-256").digest(user.toByteArray()).joinToString(""){b->"%02x".format(b)}
 fun scope(c:Context):String?=auth(c)?.optString("user")?.let{scopeFor(it)}
 @Synchronized fun deviceId(c:Context):String {val p=prefs(c);val old=p.getString("device",null);if(old!=null)return old;return java.util.UUID.randomUUID().toString().also{p.edit().putString("device",it).commit()}}
 @Synchronized fun records(c:Context,scope:String):JSONObject=try{JSONObject(prefs(c).getString("days_"+scope,"{}")!!)}catch(e:Exception){JSONObject()}
 @Synchronized fun putRecord(c:Context,scope:String,k:String,value:JSONObject){val all=records(c,scope);all.put(k,value);prefs(c).edit().putString("days_"+scope,all.toString()).commit()}
}
