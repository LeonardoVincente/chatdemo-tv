// Utility method for grabbing a query params value by name
function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

$(function(){

    var ms = window.webapis.multiscreen;

    var App = {};

    App.init = function(){
        console.log("App.init()");

        // Variables related to API
        this.channel = null;
        this.channelId = "com.samsung.multiscreen.chatdemo";        
        this.localDevice = null;

        // UI Elements
        this.dialog = $("#scDialog");
        this.elPIN = $("#elPIN");
        this.elStatus = $("#elStatus");                        
        this.videoPlayer = $("#videoPlayer").get(0);                
        
        setInterval(function() {
            App.broadcastVideoState();
        }, 1000);

        // Get the local Device (SmartTV)
        ms.Device.getCurrent(this.onDeviceRetrieved, function(error) {
            console.log("Device.getCurrent() Error : ", error);
             App.updateConnectionStatus("error: device");             
        });

        // Monitor key down for the A key so we can broadcast a test message from the TV application
        $(window).on("keydown",App.onKeyDown);

    };

    App.onDeviceRetrieved = function(device){

       console.log("App.onDeviceRetrieved", arguments);

        App.localDevice = device;
        App.updatePinCode();

        App.connectToChannel();
    };

    App.connectToChannel = function() {

        App.localDevice.openChannel(App.channelId, {name:"Host" }, App.onConnect, function(error) {
            console.log("device.openChannel() Error : ", error);
            App.updateConnectionStatus("error: channel");            
        });
        
    };

    App.onConnect = function(channel){        

        App.channel = channel;

        console.log("App.onConnect", arguments);

        // Have our UI update the connection status
        App.updateConnectionStatus("connected");

        // Wire up some event handlers
        channel.on("disconnect", function(client){
            App.onDisconnect(client);                    
        });

        channel.on("clientConnect", function(client){
            App.onClientConnect(client);        
        });

        channel.on("clientDisconnect", function(client){
            App.onClientDisconnect(client);            
        });

        channel.on("message", function(msg, client){
            msg = JSON.parse(msg);
            App.onMessage(msg, client);        
        });
        
        // Add an initial message showing the query string (for debug)
        var me = channel.clients.me;
        var message = { text:JSON.stringify(ms.getLaunchData()) || "", fromId:me.id, fromName:me.attributes.name, dateTime:new Date()};
        App.updateMessageList(message); 
        

    };

    App.onDisconnect = function(client) {
        App.updateConnectionStatus("disconnected");
        App.updateClientList(App.channel.clients);
        App.channel = null;
    };

    App.onClientConnect = function(client) {
        
        // send a welcome message to connected client
        var message = {
            type:"chat",
            text: "Welcome "+client.attributes.name+"! This message was sent to you encrypted"
        };

        client.send(JSON.stringify(message), true);

        App.updateClientList(App.channel.clients);        
    };

    App.onClientDisconnect = function(client) {
        App.updateClientList(App.channel.clients);
    };

    App.onMessage = function(message, client) {

        // process and handle messages from client 
        var type = message.type;
        
        switch(type) {

            // Video messages
            case("video"):

                var state = message.state;

                switch(state) {
                
                    case "play":
                        App.videoPlayer.play();
                    break;
                    case "pause":
                        App.videoPlayer.pause();
                    break;
                    case "stop":
                        App.videoPlayer.currentTime = 0;
                        App.videoPlayer.pause();                     
                    break;
                    case("seek"):
                        var currentTime = message.currentTime;
                        App.videoPlayer.currentTime = currentTime;
                    break;                                        
                };
                break;

            // Chat Messages
            case("chat"):                
                var uiMessage = { text:message.text, fromId:client.id, fromName:client.attributes.name, dateTime:new Date()};
                App.updateMessageList(uiMessage);
                break;
        };
        
    };


    App.onKeyDown = function(e){
        console.log("Keypressed : ", e.which);
        if(App.channel){
            if(e.which === 108 || e.which === 65){  // A (RED) key
                App.dialog.html("Broadcasting").show().fadeOut(1000);

                var message = {
                    type: "chat",
                    text: "Broadcast message from HOST",
                };

                App.channel.broadcast(JSON.stringify(message));
            }
        }
    };

    App.updatePinCode = function(){
        console.log("App.updatePinCode");
        App.localDevice.getPinCode(App.onPinCodeUpdate, function(error) {
            console.error("device.getPinCode() Error : ", error);
        });
    };

    App.onPinCodeUpdate = function(pin){
        console.log("App.onPinCodeUpdate", arguments);

        App.elPIN.html( pin.code.substr(0,3) + "-" + pin.code.substr(3,3)).hide().fadeIn();

        // Update the PIN every time it expires
        setTimeout(App.updatePinCode, pin.ttl*1000 );
    };

    App.broadcastVideoState = function() {

        if (App.channel) {

            var message = {
                type: "video",
                currentTime: App.videoPlayer.currentTime,
                paused: App.videoPlayer.paused,
                seeking: App.videoPlayer.seeking,
                ended: App.videoPlayer.ended,
                readyState: App.videoPlayer.readyState,
                duration: App.videoPlayer.duration
            };
            
            App.channel.broadcast(JSON.stringify(message));

        }
    };   

    App.updateConnectionStatus = function(status){

        console.log("App.updateConnectionStatus", arguments);

        if(status === "connected"){
            this.elStatus.html("Connected");
            this.elStatus.removeClass("label-danger");
            this.elStatus.addClass("label-success");
        }else{
            this.elStatus.html("Disconnected");
            this.elStatus.addClass("label-danger");
            this.elStatus.removeClass("label-success");
        }

    };

    App.updateClientList = function(clients){

        console.log("App.updateClientList", arguments);

        var template = $("#tplClients").html();
        $('#cntClients').html(_.template(template,{clients:clients}));
    };

    App.updateMessageList = function(message){

        console.log("App.updateMessageList", arguments);

        var template = $("#tplMessage").html();

        $('#listMessages').prepend(_.template(template,{message:message}));
    };

    App.sendReadyEvent = function() {
        console.log("App.sendReadyEvent()");
        // Notify SmartTV
        try {
            var widgetAPI = new Common.API.Widget(); // Creates Common module
            widgetAPI.sendReadyEvent(); // Sends 'ready' message to the Application Manager
        } catch(e) {
            console.error('Samsung SmartTV WidgetAPI NOT Available');
        }
    };

    // storing on the window for easier debug (watching);
    window.App = App;

    window.onunload = function(event) {      
        console.log("window.onunload()");           
    };

    window.onShow = function(event) {        
        console.log("window.onShow() event.type: " + event.type);                
    };

    window.onHide = function(event) {
        console.log("window.onHide() event.type: " + event.type);    
    };

    window.onPause = function(event) {
        console.log("window.onPause() event.type: " + event.type);     
        if (App.channel) {
            App.channel.disconnect();
        }   
    };

    window.onResume = function(event) {
        console.log("window.onResume() event.type: " + event.type);
        App.connectToChannel();    
    };  

    App.sendReadyEvent();

    // Init App
    window.App.init(); 
    

});
