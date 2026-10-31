package com.darshan.fitness
import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.*
import android.os.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.*
import java.util.concurrent.Executors

class StepService:Service(),SensorEventListener {
 companion object {@Volatile var running=false;@Volatile var message="Step tracking is off."}
 private lateinit var manager:SensorManager
 private var raw=-1f;private var lastDate="";private var scope=""
 private val handler=Handler(Looper.getMainLooper());private val executor=Executors.newSingleThreadExecutor()
 private val sync=object:Runnable{override fun run(){executor.execute{message=CloudSync.sync(this@StepService)};handler.postDelayed(this,60000)}}
 override fun onCreate(){super.onCreate();manager=getSystemService(SENSOR_SERVICE) as SensorManager}
 override fun onStartCommand(intent:Intent?,flags:Int,id:Int):Int {
  if(intent?.action=="STOP"){stopSelf();return START_NOT_STICKY}
  val account=Store.scope(this);if(account==null){message="Sign in before starting automatic steps.";stopSelf();return START_NOT_STICKY}
  if(checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)!=PackageManager.PERMISSION_GRANTED){message="Physical activity permission is required.";stopSelf();return START_NOT_STICKY}
  val sensor=manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);if(sensor==null){message="No step counter sensor. Try Health Connect import.";stopSelf();return START_NOT_STICKY}
  val nm=getSystemService(NotificationManager::class.java);nm.createNotificationChannel(NotificationChannel("steps","Automatic steps",NotificationManager.IMPORTANCE_LOW))
  val open=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  val stop=PendingIntent.getService(this,1,Intent(this,StepService::class.java).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  val n=Notification.Builder(this,"steps").setContentTitle("Darshan Fitness is counting steps").setContentText("Phone step sensor active. Tap to view progress.").setSmallIcon(android.R.drawable.ic_menu_compass).setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null,"Stop",stop).build()).build()
  try{
   if(Build.VERSION.SDK_INT>=34)startForeground(1,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)else startForeground(1,n)
   if(!running||scope!=account){manager.unregisterListener(this);scope=account;raw=-1f;lastDate="";if(!manager.registerListener(this,sensor,SensorManager.SENSOR_DELAY_NORMAL)){message="Sensor could not start.";stopSelf();return START_NOT_STICKY}}
   running=true;message="Automatic steps are on. Phone sensor updates can be delayed.";handler.removeCallbacks(sync);handler.post(sync)
  }catch(e:Exception){message="Android stopped tracking. Open the app and restart.";stopSelf();return START_NOT_STICKY}
  return START_STICKY
 }
 override fun onSensorChanged(e:SensorEvent){
  val eventMs=System.currentTimeMillis()-(SystemClock.elapsedRealtimeNanos()-e.timestamp)/1000000
  val dt=Instant.ofEpochMilli(eventMs).atZone(ZoneId.systemDefault());val date=dt.toLocalDate().toString();val current=e.values[0]
  if(raw>=0&&date==lastDate&&current>=raw){val delta=(current-raw).toInt();if(delta>0&&delta<=200000){
   val k=date+"_phone";val r=Store.records(this,scope).optJSONObject(k)?:JSONObject().put("date",date).put("source","phone_sensor").put("steps",0).put("hours",JSONArray(List(24){0}))
   r.put("steps",(r.optInt("steps")+delta).coerceAtMost(200000));val hours=r.optJSONArray("hours")?:JSONArray(List(24){0});hours.put(dt.hour,hours.optInt(dt.hour)+delta);r.put("hours",hours).put("updatedAt",System.currentTimeMillis()).put("pending",true);Store.putRecord(this,scope,k,r)
  }}
  raw=current;lastDate=date
 }
 override fun onAccuracyChanged(s:Sensor?,a:Int){}
 override fun onDestroy(){handler.removeCallbacksAndMessages(null);manager.unregisterListener(this);running=false;message="Tracking stopped. Open the app and restart to count more steps.";executor.execute{CloudSync.sync(this)};executor.shutdown();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy()}
 override fun onBind(i:Intent?) : IBinder?=null
}
