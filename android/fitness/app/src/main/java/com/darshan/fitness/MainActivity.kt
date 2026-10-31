package com.darshan.fitness

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.net.Uri
import android.os.*
import android.webkit.*
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.*
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.*

class MainActivity:ComponentActivity(){
 private lateinit var web:WebView
 private var picker:ValueCallback<Array<Uri>>?=null
 private var pendingExport:String?=null
 private val permissionLauncher=registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){startStepsIfAllowed()}
 private val documentLauncher=registerForActivityResult(ActivityResultContracts.StartActivityForResult()){r->picker?.onReceiveValue(if(r.resultCode==RESULT_OK&&r.data?.data!=null)arrayOf(r.data!!.data!!)else null);picker=null}
 private val exportLauncher=registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")){uri->if(uri!=null&&pendingExport!=null)try{contentResolver.openOutputStream(uri)?.use{it.write(pendingExport!!.toByteArray())};message("Backup exported.")}catch(e:Exception){message("Backup could not be exported.")};pendingExport=null}
 private val healthPermissions=setOf(HealthPermission.getReadPermission(StepsRecord::class),HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),HealthPermission.getReadPermission(DistanceRecord::class),HealthPermission.getReadPermission(ExerciseSessionRecord::class))
 private val healthLauncher=registerForActivityResult(PermissionController.createRequestPermissionResultContract()){granted->if(granted.isNotEmpty())readSamsungHealth()else message("Health Connect permission was not granted.")}
 override fun onCreate(saved:Bundle?){super.onCreate(saved);web=WebView(this);setContentView(web)
  web.setOnApplyWindowInsetsListener{v,i->if(Build.VERSION.SDK_INT>=30){val b=i.getInsets(android.view.WindowInsets.Type.systemBars());v.setPadding(b.left,b.top,b.right,b.bottom)}else v.setPadding(i.systemWindowInsetLeft,i.systemWindowInsetTop,i.systemWindowInsetRight,i.systemWindowInsetBottom);i}
  web.settings.javaScriptEnabled=true;web.settings.domStorageEnabled=true;web.settings.allowFileAccess=false;web.settings.allowContentAccess=true;web.settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
  web.addJavascriptInterface(Bridge(),"StrideNative")
  web.webViewClient=object:WebViewClient(){override fun shouldOverrideUrlLoading(v:WebView,r:WebResourceRequest):Boolean{val u=r.url;if(u.scheme=="https"&&u.host=="darshan-eeshwar.github.io"&&u.path.orEmpty().startsWith("/fitness/")&&!u.path.orEmpty().endsWith(".apk"))return false;try{startActivity(Intent(Intent.ACTION_VIEW,u))}catch(e:Exception){message("This link could not be opened.")};return true}}
  web.webChromeClient=object:WebChromeClient(){override fun onJsConfirm(v:WebView,url:String,msg:String,result:JsResult):Boolean{AlertDialog.Builder(this@MainActivity).setMessage(msg).setPositiveButton("Continue"){_,_->result.confirm()}.setNegativeButton("Cancel"){_,_->result.cancel()}.setOnCancelListener{result.cancel()}.show();return true}
   override fun onShowFileChooser(v:WebView,cb:ValueCallback<Array<Uri>>,p:FileChooserParams):Boolean{picker?.onReceiveValue(null);picker=cb;documentLauncher.launch(Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE));return true}}
  web.loadUrl("https://darshan-eeshwar.github.io/fitness/")
 }
 private fun message(text:String){runOnUiThread{if(!isFinishing)web.evaluateJavascript("window.nativeMessage("+JSONObject.quote(text)+")",null)}}
 private fun startSteps(){val sm=getSystemService(SENSOR_SERVICE) as SensorManager;if(sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)==null){message("This phone has no step counter sensor. Try Health Connect.");return};val list=mutableListOf<String>();if(checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)!=PackageManager.PERMISSION_GRANTED)list.add(Manifest.permission.ACTIVITY_RECOGNITION);if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)list.add(Manifest.permission.POST_NOTIFICATIONS);if(list.isNotEmpty())permissionLauncher.launch(list.toTypedArray())else startStepsIfAllowed()}
 private fun startStepsIfAllowed(){if(checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)!=PackageManager.PERMISSION_GRANTED){message("Physical activity permission is required for automatic steps.");return};try{startForegroundService(Intent(this,StepService::class.java));message("Step counting started. Keep your phone with you.")}catch(e:Exception){message("Android could not start tracking. Reopen the app and try again.")}}
 private fun healthSync(){if(Store.auth(this)==null){message("Sign in before importing health data.");return};if(HealthConnectClient.getSdkStatus(this)!=HealthConnectClient.SDK_AVAILABLE){message("Health Connect is not available. Install or update it in phone Settings.");return};AlertDialog.Builder(this).setTitle("Import Samsung Health activity").setMessage("Enable Samsung Health → Settings → Health Connect first. The selected activity data from the last 30 days will be read and saved to your signed-in Darshan Fitness account. You can deny or revoke access in Health Connect.").setPositiveButton("Choose permissions"){_,_->healthLauncher.launch(healthPermissions)}.setNegativeButton("Cancel",null).show()}
 private fun readSamsungHealth(){lifecycleScope.launch{
  try{val client=HealthConnectClient.getOrCreate(this@MainActivity);val granted=client.permissionController.getGrantedPermissions();val scope=Store.scope(this@MainActivity)?:return@launch;val origin=setOf(DataOrigin("com.sec.android.app.shealth"));var days=0
   message("Reading the last 30 days shared by Samsung Health…")
   for(offset in 29 downTo 0){
    if(Store.scope(this@MainActivity)!=scope)break
    val date=LocalDate.now().minusDays(offset.toLong());val zone=ZoneId.systemDefault();val start=date.atStartOfDay(zone).toInstant();val end=minOf(date.plusDays(1).atStartOfDay(zone).toInstant(),Instant.now());if(end<=start)continue
    val metrics=mutableSetOf<androidx.health.connect.client.aggregate.AggregateMetric<*>>()
    if(granted.contains(HealthPermission.getReadPermission(StepsRecord::class)))metrics.add(StepsRecord.COUNT_TOTAL)
    if(granted.contains(HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)))metrics.add(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
    if(granted.contains(HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)))metrics.add(TotalCaloriesBurnedRecord.ENERGY_TOTAL)
    if(granted.contains(HealthPermission.getReadPermission(DistanceRecord::class)))metrics.add(DistanceRecord.DISTANCE_TOTAL)
    val row=JSONObject().put("date",date.toString()).put("source","health_connect").put("hours",JSONArray(List(24){0}));var hasData=false
    if(metrics.isNotEmpty()){
     val agg=client.aggregate(AggregateRequest(metrics,TimeRangeFilter.between(start,end),origin))
     agg[StepsRecord.COUNT_TOTAL]?.let{row.put("steps",it);hasData=true}
     agg[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let{row.put("activeCalories",it.inKilocalories);hasData=true}
     agg[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.let{row.put("totalCalories",it.inKilocalories);hasData=true}
     agg[DistanceRecord.DISTANCE_TOTAL]?.let{row.put("distanceKm",it.inKilometers);hasData=true}
     if(metrics.contains(StepsRecord.COUNT_TOTAL)){val hours=JSONArray(List(24){0});for(bucket in client.aggregateGroupByDuration(AggregateGroupByDurationRequest(setOf(StepsRecord.COUNT_TOTAL),TimeRangeFilter.between(start,end),Duration.ofHours(1),origin))){val h=bucket.startTime.atZone(zone).hour;hours.put(h,hours.optLong(h)+(bucket.result[StepsRecord.COUNT_TOTAL]?:0L))};row.put("hours",hours)}
    }
    if(granted.contains(HealthPermission.getReadPermission(ExerciseSessionRecord::class))){val intervals=mutableListOf<Pair<Instant,Instant>>();var token:String?=null;do{val response=client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class,TimeRangeFilter.between(start,end),dataOriginFilter=origin,pageToken=token));response.records.forEach{val a=maxOf(start,it.startTime);val b=minOf(end,it.endTime);if(b>a)intervals.add(a to b)};token=response.pageToken}while(token!=null);if(intervals.isNotEmpty()){var a=intervals.sortedBy{it.first}.first().first;var b=a;var seconds=0L;for(pair in intervals.sortedBy{it.first}){if(pair.first>b){seconds+=Duration.between(a,b).seconds;a=pair.first;b=pair.second}else b=maxOf(b,pair.second)};seconds+=Duration.between(a,b).seconds;row.put("activeMinutes",seconds/60.0);hasData=true}}
    if(hasData){row.put("updatedAt",System.currentTimeMillis()).put("pending",true);Store.putRecord(this@MainActivity,scope,date.toString()+"_hc",row);days++}
   }
   val result=withContext(Dispatchers.IO){CloudSync.sync(this@MainActivity)};message("Imported $days days. $result")
  }catch(e:SecurityException){message("Health permission changed. Reconnect in Health Connect to retry.")}catch(e:Exception){message("Some Samsung data could not be read. Check Health Connect sharing and retry.")}
 }}
 private inner class Bridge{
  @JavascriptInterface fun setSession(token:String,user:String){if(!token.matches(Regex("[a-f0-9]{64}"))||!user.matches(Regex("[a-z0-9_]{3,30}")))return;val old=Store.auth(this@MainActivity)?.optString("user");if(old!=null&&old!=user)stopService(Intent(this@MainActivity,StepService::class.java));Store.setSession(this@MainActivity,token,user)}
  @JavascriptInterface fun clearSession(){stopService(Intent(this@MainActivity,StepService::class.java));Store.clearSession(this@MainActivity)}
  @JavascriptInterface fun startTracking(){runOnUiThread{startSteps()}}
  @JavascriptInterface fun stopTracking(){stopService(Intent(this@MainActivity,StepService::class.java));message("Automatic steps stopped.")}
  @JavascriptInterface fun healthSync(){runOnUiThread{this@MainActivity.healthSync()}}
  @JavascriptInterface fun status():String {val scope=Store.scope(this@MainActivity);return JSONObject().put("running",StepService.running).put("message",StepService.message).put("deviceId",Store.deviceId(this@MainActivity)).put("records",if(scope!=null)Store.records(this@MainActivity,scope)else JSONObject()).toString()}
  @JavascriptInterface fun exportData(raw:String){if(raw.length>2000000)return;runOnUiThread{pendingExport=raw;exportLauncher.launch("darshan-fitness-backup.json")}}
 }
 @Deprecated("Deprecated in Java") override fun onBackPressed(){if(web.canGoBack())web.goBack()else super.onBackPressed()}
 override fun onDestroy(){web.removeJavascriptInterface("StrideNative");web.destroy();super.onDestroy()}
}
class PrivacyActivity:android.app.Activity(){override fun onCreate(b:Bundle?){super.onCreate(b);AlertDialog.Builder(this).setTitle("Darshan Fitness privacy").setMessage("This app reads steps and the activity types you allow in Health Connect, only when you request an import. Samsung Health data from the last 30 days is saved to your Darshan Fitness account. Automatic phone steps use a foreground service and visible notification. No GPS, contacts, microphone or camera access is requested. Session tokens are encrypted with Android Keystore. Stop tracking in the app or notification; revoke Health Connect access in phone Settings. Cloud records are account-protected. Backups contain private fitness data. This is not a medical device.").setPositiveButton("Close"){_,_->finish()}.setOnCancelListener{finish()}.show()}}
