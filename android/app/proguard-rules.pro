# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# --- Gənclər Evi: R8 qaydaları ---
-keepattributes *Annotation*, SourceFile, LineNumberTable, Signature, InnerClasses, EnclosingMethod

# Capacitor və onun plaginləri (reflection ilə çağırılır)
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep class io.capawesome.** { *; }
-keep class com.aparajita.** { *; }
-keep class capacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}

# WebView ↔ JavaScript körpüsü
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ML Kit QR skaner və AndroidX
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-dontwarn com.google.mlkit.**
-dontwarn org.apache.cordova.**
