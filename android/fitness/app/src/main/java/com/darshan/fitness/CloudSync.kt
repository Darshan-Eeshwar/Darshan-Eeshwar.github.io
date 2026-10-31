package com.darshan.fitness
import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
object CloudSync {
 @Synchronized fun sync(c:Context):String {
  val auth=Store.auth(c)?:return "Sign in to sync steps."
  val scope=Store.scopeFor(auth.getString("user"))
  val all=Store.records(c,scope);var synced=0
  for(k in all.keys().asSequence().toList()){
   val r=all.getJSONObject(k);if(!r.optBoolean("pending"))continue
   try{
    val connection=URL("https://duehzbkziwvsfnjrcsxp.supabase.co/functions/v1/darshan-fitness-api/api/device/sync").openConnection() as HttpURLConnection
    connection.requestMethod="POST";connection.connectTimeout=15000;connection.readTimeout=15000;connection.doOutput=true
    connection.setRequestProperty("Origin","https://darshan-eeshwar.github.io");connection.setRequestProperty("Content-Type","application/json");connection.setRequestProperty("x-fitness-session",auth.getString("token"))
    val payload=JSONObject(r.toString()).put("deviceId",Store.deviceId(c));payload.remove("pending")
    connection.outputStream.use{it.write(payload.toString().toByteArray())};val status=connection.responseCode;connection.disconnect()
    if(status==401)return "Sign in again to resume cloud sync. Local steps are saved."
    if(status !in 200..299)return "Steps saved on this phone. Cloud sync will retry."
    // Do not clear a newer sensor update that arrived while the request ran.
    val current=Store.records(c,scope).optJSONObject(k)
    if(current!=null&&current.optLong("updatedAt")==r.optLong("updatedAt")){current.put("pending",false);Store.putRecord(c,scope,k,current)}
    synced++
   }catch(e:Exception){return "Steps saved on this phone. Waiting for network."}
  }
  return if(synced>0)"Steps synced to your fitness account." else "Cloud sync is up to date."
 }
}
