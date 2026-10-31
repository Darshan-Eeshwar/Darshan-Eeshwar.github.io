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
import org.json.JSONArray
import org.json.JSONObject

class MainActivity:ComponentActivity(){
 private lateinit var web:WebView
 private var picker:ValueCallback<Array<Uri>>?=null
 private var pendingExport:String?=null
 private var autoPermissionRequested=false
 private val permissionLauncher=registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){startStepsIfAllowed()}
 private val documentLauncher=registerForActivityResult(ActivityResultContracts.StartActivityForResult()){r->picker?.onReceiveValue(if(r.resultCode==RESULT_OK&&r.data?.data!=null)arrayOf(r.data!!.data!!)else null);picker=null}
 private val exportLauncher=registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")){uri->if(uri!=null&&pendingExport!=null)try{contentResolver.openOutputStream(uri)?.use{it.write(pendingExport!!.toByteArray())};message("Backup exported.")}catch(e:Exception){message("Backup could not be exported.")};pendingExport=null}
 override fun onCreate(saved:Bundle?){super.onCreate(saved);web=WebView(this);setContentView(web)
  web.setOnApplyWindowInsetsListener{v,i->if(Build.VERSION.SDK_INT>=30){val b=i.getInsets(android.view.WindowInsets.Type.systemBars());v.setPadding(b.left,b.top,b.right,b.bottom)}else v.setPadding(i.systemWindowInsetLeft,i.systemWindowInsetTop,i.systemWindowInsetRight,i.systemWindowInsetBottom);i}
  web.settings.javaScriptEnabled=true;web.settings.domStorageEnabled=true;web.settings.allowFileAccess=false;web.settings.allowContentAccess=true;web.settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
  web.addJavascriptInterface(Bridge(),"DarshanFitnessNative")
  web.webViewClient=object:WebViewClient(){override fun shouldOverrideUrlLoading(v:WebView,r:WebResourceRequest):Boolean{val u=r.url;if(u.scheme=="https"&&u.host=="darshan-eeshwar.github.io"&&u.path.orEmpty().startsWith("/fitness/")&&!u.path.orEmpty().endsWith(".apk"))return false;try{startActivity(Intent(Intent.ACTION_VIEW,u))}catch(e:Exception){message("This link could not be opened.")};return true}}
  web.webChromeClient=object:WebChromeClient(){override fun onJsConfirm(v:WebView,url:String,msg:String,result:JsResult):Boolean{AlertDialog.Builder(this@MainActivity).setMessage(msg).setPositiveButton("Continue"){_,_->result.confirm()}.setNegativeButton("Cancel"){_,_->result.cancel()}.setOnCancelListener{result.cancel()}.show();return true}
   override fun onShowFileChooser(v:WebView,cb:ValueCallback<Array<Uri>>,p:FileChooserParams):Boolean{picker?.onReceiveValue(null);picker=cb;documentLauncher.launch(Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE));return true}}
  web.loadUrl("https://darshan-eeshwar.github.io/fitness/")
 }
 private fun message(text:String){runOnUiThread{if(!isFinishing)web.evaluateJavascript("window.nativeMessage("+JSONObject.quote(text)+")",null)}}
 private fun startSteps(){if(Store.auth(this)==null)return;val sm=getSystemService(SENSOR_SERVICE) as SensorManager;if(sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)==null){message("This phone has no step counter sensor. You can still use manual step logs.");return};val list=mutableListOf<String>();if(checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)!=PackageManager.PERMISSION_GRANTED)list.add(Manifest.permission.ACTIVITY_RECOGNITION);if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)list.add(Manifest.permission.POST_NOTIFICATIONS);if(list.isNotEmpty()){autoPermissionRequested=true;permissionLauncher.launch(list.toTypedArray())}else startStepsIfAllowed()}
 private fun startStepsIfAllowed(){if(Store.auth(this)==null||!Store.trackingEnabled(this))return;if(checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)!=PackageManager.PERMISSION_GRANTED){message("Physical activity permission is required for automatic steps.");return};try{startForegroundService(Intent(this,StepService::class.java));message("Step counting started. Keep your phone with you.")}catch(e:Exception){message("Android could not start tracking. Reopen the app and try again.")}}
 private inner class Bridge{
  @JavascriptInterface fun setSession(token:String,user:String){if(!token.matches(Regex("[a-f0-9]{64}"))||!user.matches(Regex("[a-z0-9_]{3,30}")))return;val old=Store.auth(this@MainActivity)?.optString("user");if(old!=null&&old!=user)stopService(Intent(this@MainActivity,StepService::class.java));Store.setSession(this@MainActivity,token,user);runOnUiThread{if(Store.trackingEnabled(this@MainActivity)&&(!autoPermissionRequested||checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)==PackageManager.PERMISSION_GRANTED))startSteps()}}
  @JavascriptInterface fun clearSession(){stopService(Intent(this@MainActivity,StepService::class.java));Store.clearSession(this@MainActivity)}
  @JavascriptInterface fun startTracking(){runOnUiThread{Store.setTrackingEnabled(this@MainActivity,true);startSteps()}}
  @JavascriptInterface fun stopTracking(){Store.setTrackingEnabled(this@MainActivity,false);stopService(Intent(this@MainActivity,StepService::class.java));message("Automatic steps paused. Tap Resume to count again.")}
  @JavascriptInterface fun status():String {val scope=Store.scope(this@MainActivity);return JSONObject().put("enabled",Store.trackingEnabled(this@MainActivity)).put("running",StepService.running).put("message",StepService.message).put("deviceId",Store.deviceId(this@MainActivity)).put("records",if(scope!=null)Store.records(this@MainActivity,scope)else JSONObject()).toString()}
  @JavascriptInterface fun exportData(raw:String){if(raw.length>2000000)return;runOnUiThread{pendingExport=raw;exportLauncher.launch("darshan-fitness-backup.json")}}
 }
 override fun onResume(){super.onResume();if(Store.auth(this)!=null&&Store.trackingEnabled(this)&&checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)==PackageManager.PERMISSION_GRANTED)startStepsIfAllowed()}
 @Deprecated("Deprecated in Java") override fun onBackPressed(){if(web.canGoBack())web.goBack()else super.onBackPressed()}
 override fun onDestroy(){web.removeJavascriptInterface("DarshanFitnessNative");web.destroy();super.onDestroy()}
}
