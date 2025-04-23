"use strict";
/*
	Version: WebApp

	Grundsetting mit laden/speichern der aktuellen Fensterposition und Größe (+Setting in Programmeinstellungen)
	
	alle Maße in mm
	
	
	TODO: 
	-farbige Linien -> gcode Select Tool? "; color:#rrggbb" M280 P0 S0  P=Servonr.
	
*/
/*
	HTML:
	<body class="main">
		<div id="myapplication">
			<div id="zeichenfeld">										
				<canvas id="canHG"/>									für Maße, sonst nicht genutzt (TODO: überflüssig?)
				<canvas id="canVorlage"/>								Vorlagebild
				<canvas id="canLines"/>									Gitter
				<canvas id="canZeichnung"/>								Zeichnung
				<div id="ladebalken"><div id="lbfill"></div></div>		Ladebalken, oberhalb
				<canvas id="canDraw"/>									aktuelle Linie die gerade gezeichnet wird
			</div>
			<div id="werkzeuge">
				<a class="ocbutt"></a>									Button um Seitenmenü ein-/auszuschalten
				<article></article>										Gruppe mit Buttons input etc.
				...
			</div>
			<div id="dialog"></div>
		</div>
	</body>
*/
/*
optionen.json
{
"gcodeoptions":{"spiegelY":false,"spiegelX":true}

,"drawoptions":{"abweichung":6,"abstandmin":0.8,"grobabweichung":80,"weitemm":2.5,"showgrid":true,"blatt":{"width":100,"height":100,"zoom":1}},
"dateiio":{"lastdateiname":"D:\\grafik\\_test_.gcode"}

}
*/



var splinewriter=function(){
	var progversion="Version 0.3.7";
	
	var Programmeinstellungen={//als Einstellungen gespeichert
		sprache:"DE",
		gcodevorlagen:[
			{	"name":"Plotter",
				"erasable":false,
				"gcodeprestart":	";$sysinfo\nG21 ; set units to millimeters\nG90 ; use absolute coordinates\n\n",//Zeilenumbruch mit "\n"
				"gcodestart":		"M400 ; Wait for current moves to finish\nM280 P0 S83 ;Servo up\nG4 P200 ;wait 200ms",
				"gcodeLinienbegin":	"M400 ; wait\nM280 P0 S0 ;servo down\nG4 P200 ;wait 200ms",
				"gcodeLinienende":	"M400 ; wait\nM280 P0 S80 ;servo up\nG4 P200 ;wait 200ms",
				"gcodeende":		"M280 P0 S83; servo up\nG4 P200;wait 200ms\n\n$movetoYmax\nM84 ;disable Motors",
				"movespeed":1500,	//max F5000
				"drawspeed":600,	//max F5000
				"spiegelX":true,
				"spiegelY":false,
				"negativX":false,
				"negativY":false,
				"durchmesser":0.5 //mm
				
			}
			,		
			{	"name":"Laser",
				"erasable":false,
				"gcodeprestart":	";$sysinfo\nG90 ;absolute Position\nM08 ;Flood Coolant On\nG21 ; set units to millimeters\n\n",//Zeilenumbruch mit "\n"
				"gcodestart":		"",
				"gcodeLinienbegin":	"M3",
				"gcodeLinienende":	"M5",
				"gcodeende":		"M9 ; Coolant Off\n$movetoStart",
				"movespeed":600,	//max F5000
				"drawspeed":600,	//max F5000
				"spiegelX":true,
				"spiegelY":false,
				"negativX":false,
				"negativY":false,
				"durchmesser":0.05 //mm
			}
			,		
			{	"name":"Laserstorm S10",//0.01
				"erasable":false,
				"gcodeprestart":	"",//Zeilenumbruch mit "\n"
				"gcodestart":		"",
				"gcodeLinienbegin":	"M3",
				"gcodeLinienende":	"M5",
				"gcodeende":		"",
				"movespeed":1000,	//max F5000
				"drawspeed":1000,	//max F5000
				"spiegelX":true,
				"spiegelY":false,
				"negativX":false,
				"negativY":false,
				"durchmesser":0.04 //mm
			}
		
		]
		,
		gcodeoptionsV2:{
				"gcodeprestart":	"; $sysinfo\nG21 ; set units to millimeters\nG90 ; use absolute coordinates\n",//Zeilenumbruch mit "\n"
				"gcodestart":		"M400 ; Wait for current moves to finish\nM280 P0 S83 ;Servo up\nG4 P200 ;wait 200ms",
				"gcodeLinienbegin":	"M400 ; wait\nM280 P0 S0 ;servo down\nG4 P200 ;wait 200ms",
				"gcodeLinienende":	"M400 ; wait\nM280 P0 S40 ;servo up\nG4 P200 ;wait 200ms",
				"gcodeende":			"M280 P0 S83; servo up\nG4 P200;wait 200ms\n\n$movetoYmax\nM84 ;disable Motors",
				"movespeed":600,	//max F5000
				"drawspeed":600,	//max F5000
				"spiegelX":true,
				"spiegelY":false,
				"negativX":false,
				"negativY":false,
				"durchmesser":0.5	//mm	
		},
		drawoptions:{
			//Line-Optimierungen
			"abweichung":6,			//°Winkel
			"abstandmin":0.8,  		//mm
			"grobabweichung":80,	//°Winkel	
			"weitemm":10,			//verschiebe um mm
			
			"showgrid":true,
			
			"blatt":{"width":100,"height":100,"zoom":1}
		},
		dateiio:{
			"lastdateiname":""
		},
		importoptionen:{
			"genauigkeit":100
		}
	};
	
	var appdata={
		userdokumente:"",
		userbilder:"",
		pathData:"",
		ProgrammOrdner:"SplineWriter",
		DateinameOptionen:"optionen.json"
	}
	
	var inpElementeList=[];//Werkzeug-InputElemente
	var outElementeList=[];//Werkzeug-OutputElemente
	
	var zielNode;
	var oEbenenElement;
	
	var translatetElements=[];
	
	var dateitypen=[
		{"typ":"gcode"	,"endung":['.gcode','.nc']},
		{"typ":"svg"	,"endung":['.svg']},
		{"typ":"ai"	,"endung":['.ai']}
		];
		
	
	var farbeStift="#1b6d97";
	var farbeZeichnung="#222222";
	var farbeZeichnungEbeneaktiv="#1b6d97";
	var farbepunkteStart="#ff0000";
	var farbepunkte="#ffd65b";
	
	var ebenenset=[//Name automatisch
		{"name":"","color":farbeZeichnung}
	];
	var ebenaktiv=0; 
	//var zeichnung=[] -->Punkt hat Eigenschaft von ebene
	var modifizierealles=true;//Zeichnung oder Ebene verschieben, etc.
	
	//--Beispiele--
	var beispielliste=["","maus.svg","pferd.gcode","tieger.gcode"];//gcode läd schneller!
	var beispiellistepfad="exampel/";		
	var inpBeispiele;
	
	
	//--basic--
	var gE=function(id){if(id=="")return undefined; else return document.getElementById(id);}
	var cE=function(z,e,id,cn){
		var newNode=document.createElement(e);
		if(id)newNode.id=id;
		if(cn)newNode.className=cn;
		if(z)z.appendChild(newNode);
		return newNode;
	}
	var istClass=function(htmlNode,className){
		return htmlNode?.className?.split(' ').includes(className) || false;
	}
	var addClass=function(htmlNode,className){	
		if(htmlNode){
			if(!istClass(htmlNode,className)){
			  htmlNode.classList.add(className);
			}
		}		
	}
	var subClass=function(htmlNode,classe){
		if (htmlNode && htmlNode.classList) {
			htmlNode.classList.remove(classe);
		 }
	}
	var delClass=function(htmlNode){
		if(htmlNode!=undefined) htmlNode.className="";		
	}
	var getClasses=function(htmlNode){return htmlNode.className;}
	
	var streckenlaenge2D=function(p1,p2) {//[x,y][x,y] c²=a²+b²
		return Math.sqrt( Math.pow(p2[1]-p1[1],2)+Math.pow(p2[0]-p1[0],2));
	} 
	var getWinkel=function(p0,p1,p2 ,rkorr){//[x,y][x,y][x,y]
		//Winkel Strecke p0-p1 zu p1-p2 in Grad
		var re=0;
		var a=streckenlaenge2D(p1,p2);
		var b=streckenlaenge2D(p0,p2);
		var c=streckenlaenge2D(p0,p1);	
		
		if(a>0 && b>0 && c>0)
			re=Math.acos((a*a+c*c-b*b)/(2*a*c))* 180/Math.PI;
//console.log(Math.floor(re*100)/100);		
		//p1.x links von p2.x?
 
		 if(isNaN(re)){
			 //console.log(">>",a,b,c,p0,p1,p2);
			 re=180;//drei Punkte auf einer Geraden
		 }
		if(rkorr)if(p1[0]<p2[0])re=re*-1;
 
		return Math.floor(re*100)/100;
	}
	
	var streckenlaengePoint=function(p1,p2){
		return Math.sqrt( Math.pow(p2.y-p1.y,2)+Math.pow(p2.x-p1.x,2));
	}
	
	var getMouseP=function(e){
		if(e.changedTouches!=undefined){//touch devices
			var te=e.changedTouches[0];
			return {x:te.clientX ,y:te.clientY}
		}
		
		//mausdevices
		return{
			x:document.all ? window.event.clientX : e.pageX,	//pageX
			y:document.all ? window.event.clientY : e.pageY
			};
	}
	var getPos=function(re,o){
		var r=o.getBoundingClientRect();
		re.x-=r.left;
		re.y-=r.top;
		return re;
	}
	var relMouse=function(e,o){
		return getPos(getMouseP(e),o);
	}
		
		
	//--electron dummyfunctions--
	
	var addprobs=function(ziel,props){
		var property;
		
		for( property in props ) {
			if(typeof props[property] === "object"){
				if(ziel[property]==undefined)ziel[property]={};
				addprobs(ziel[property],props[property]);		//rekursiev, jede Eigenschaft an Objekt seperat anhängen
			}
			else
				ziel[property]=props[property];
		}
	}
	var getSettingsAtStart=function(){
		var r,optionen;
			
		/*if(fs.existsSync(appdata.pathData+appdata.DateinameOptionen)){
			r=fs.readFileSync(appdata.pathData+appdata.DateinameOptionen,'utf-8',"a");
			if(r!=""){
				console.log('loaded',appdata.pathData+appdata.DateinameOptionen);
				optionen=JSON.parse(r);
				
				
				//settings
				//gespeicherte Propertys anfügen/ersetzen
				addprobs(Programmeinstellungen,optionen);
				console.log(Programmeinstellungen,optionen);
			}
		}
		else{
			console.log("keine Optionsdatei gefunden. "+appdata.pathData+appdata.DateinameOptionen);
		}*/
	}

	var savesettingtimer=undefined;
	var saveSettings=function(){
		if(savesettingtimer!=undefined)clearTimeout(savesettingtimer);
		savesettingtimer=setTimeout(saveSettingsNow,50);//50ms Verzug, da Mehrfachaufrufe erfolgen
	}
	
	var saveSettingsNow=function(){
		if(savesettingtimer!=undefined){
			clearTimeout(savesettingtimer);
			savesettingtimer=undefined;
		}
		//asyncron
		//console.log("save",JSON.stringify(Programmeinstellungen));
	}	
	
		
	//--basicsEvent--
	
	this.ini=function(zielid){
		//electron basisc ini
		
		getSettingsAtStart();
		
		//myProgramm
		zielNode=gE(zielid);
		zielNode.innerHTML="";		
		
		CreateProgramm();
	}
		
	//--Programm--
	var zeichenfeld;	
	var werkzeuge;
	var thedialog;
	var statusleiste;
	
		
	var CreateProgramm=function(){
		//zielNode.innerHTML="Hallo.";
		var node;
		statusleiste=new oStatuszielNode();
		
		zeichenfeld=new oZeichenfeld(zielNode);
		
		werkzeuge=new oWerkzeuge(zielNode);
		
		thedialog=new oDialog(zielNode);
		
		zeichenfeld.setEbene();
		zeichenfeld.resize();
	}
	
	var oStatuszielNode=function(ziel){
		var basis,zl,zm,zr;
		
		
		this.printL=function(s){
			zl.innerHTML=s;	
		}
		this.printM=function(s){
			zm.innerHTML=s;	
		}
		this.printR=function(s){
			zr.innerHTML=s;	
		}
		
		
		//--ini--		
		var create=function(){
			//
			var basis=cE(zielNode,"div","status");
			zl=cE(basis,"div","statL");
			zm=cE(basis,"div","statM");
			zr=cE(basis,"div","statR");
			

			zr.innerHTML=progversion
		}
		
		create();
	}
	
	
	var oWerkzeuge=function(ziel){
		var openclosebutt;
		var inpStaerke;
		var inpWidth;
		var inpHeight;
		var inpZoom;
		
		//var inpAnzahlStriche;
		var inpShowgrid;
		var inpShowdots;
		var inpShowdrawing;
		
		//--API--
		this.get=function(sWert){
			
			Programmeinstellungen.drawoptions.blatt.width=parseInt(inpWidth.getVal());
			Programmeinstellungen.drawoptions.blatt.height= parseInt(inpHeight.getVal());
			Programmeinstellungen.drawoptions.blatt.zoom= parseFloat(inpZoom.getVal());
			Programmeinstellungen.drawoptions.showgrid=inpShowgrid.getVal();
			
			if(sWert=="width")	return parseInt(inpWidth.getVal());
			if(sWert=="height")	return parseInt(inpHeight.getVal());
			if(sWert=="zoom")	return parseFloat(inpZoom.getVal());
			if(sWert=="linewidth")	return parseFloat(inpStaerke.getVal());
			if(sWert=="showgrid")return inpShowgrid.getVal();
			if(sWert=="showdots")return inpShowdots.getVal();
			if(sWert=="showdraw")return inpShowdrawing.getVal();
		}
		this.set=function(id,wert){
			if(id=="width")	inpWidth.setVal(parseInt(wert));
			if(id=="height")inpHeight.setVal(parseInt(wert));
			//if(id=="zoom")inpHeight.setVal(parseFloat(wert));
			saveSettings();
		}
		
		//--input-actions--
		var wopenclose=function(e){
			if( istClass(zielNode,"werkzeugeoffen") )
				subClass(zielNode,"werkzeugeoffen");
			else
				addClass(zielNode,"werkzeugeoffen");
			
			if(zeichenfeld){zeichenfeld.resize()}
			
			e.preventDefault();//return false
		}
		
		var changeElemente=function(v){
			if(zeichenfeld)zeichenfeld.resize();
			saveSettings();
		}
			
		var changeExportOptionen=function(v){
			var i,ipe;
			//console.log(v,inpElementeList);
			for(i=0;i<inpElementeList.length;i++){
				ipe=inpElementeList[i];
				
				if(ipe.getName()==getWort('showgrid')){Programmeinstellungen.drawoptions.showgrid=ipe.getVal();}
			}
			
			updateOutElemente();
			
			//save Programmeinstellungen
			saveSettings();
		}
		
		
		var cangeInputvorlage=function(e){console.log("chage imputfile");
			var inputFile=this;
			var reader = new FileReader();console.log("reader",reader);
			reader.onload = function(theFile) {
				var data=this.result;
				var ifile=inputFile.files[0];
				var filename=ifile.name.toLowerCase();
				
				if(filename.indexOf(".jpg")>-1 
					|| filename.indexOf(".jpeg")>-1 
					|| filename.indexOf(".png")>-1 
					|| filename.indexOf(".bmp")>-1 
					|| filename.indexOf(".gif")>-1 
					){
					console.log("bild:",URL.createObjectURL(ifile));
					if(zeichenfeld)zeichenfeld.loadvorlage(URL.createObjectURL(ifile));//blob			
				}; 
			};
			reader.readAsBinaryString(inputFile.files[0]);	
		}
			
		var cangeInputloadgcode=function(e){
			var inputFile=this;
			var reader = new FileReader();
			//window.File && window.FileReader && window.FileList && window.Blob
			
			reader.onload = function(theFile) {
				var data=this.result;
				var ifile=inputFile.files[0];
				var filename=ifile.name.toLowerCase();
				var i,t,dtyp;
				var isvalidFiletype=false;
				for(i=0;i<dateitypen.length;i++){
					dtyp=dateitypen[i];
					for(t=0;t<dtyp.endung.length;t++){
						if(filename.indexOf( dtyp.endung[t])>-1 )isvalidFiletype=true;
					}
				}
				
				if(isvalidFiletype){
					if(zeichenfeld)zeichenfeld.importgcodesvg(filename,theFile.target.result);
				}
				else
				{
					alert(getWort("Dateitypunbekannt"));
				} 
			};
			reader.readAsText(inputFile.files[0]);	
		}
			
		var translateitems=function(){
			var i,o,node,s;
			for(i=0;i<translatetElements.length;i++){
				o=translatetElements[i];
				node=o.n;
				s=getWort(o.id);
				if(o.a!=undefined)s+=getWort(o.a);
				
				if(node.type==="button"){
					node.value=s;
				}
				else{
					node.innerHTML=s;					
				}
			}
			updateOutElemente();
		}
		
		
		var changeMofifiElemente=function(input){
			modifizierealles=!input.getVal();
		}
		
		//--ini--		
		var create=function(){
			//
			var div,inpbutt,gruppe,h1,i,label,input,node,span;
			var werkznode=cE(zielNode,"div","werkzeuge");
			
			//Werkzeuge ein/ausfahren
			openclosebutt=cE(werkznode,"a",undefined,"ocbutt");
			openclosebutt.innerHTML="";
			openclosebutt.href="#";
			openclosebutt.addEventListener('click',wopenclose);
			
			if(Programmeinstellungen.sprache!=undefined)
				spracheaktiv=Programmeinstellungen.sprache;
			
		
		/*
			(gruppenname +-)		
			|optionen |
			...
		
			<article>
				<h1>gruppenname</h1>+klickevent
				<div><label /><input /><span /><div> //Textdavor, input(text,number,range) textdanach
				
				<div><label /><input /><label htmlfor /><div> //Switchbutton (checkbox)
				
				<div><input /><div> //Button (button)
				
			</article>
		
		*/
			
			//Info
			//inpAnzahlStriche=new inputElement(getWort('anzlinien'),'text',node);
			//inpAnzahlStriche.inaktiv(true);
			
			//div=cE(node,"div",undefined,"linetop");
			
			gruppe=cE(werkznode,"article");
			//Blatt			
			h1=cE(gruppe,"h1");
			h1.innerHTML=getWort("Zeichenflaeche")+":";
			translatetElements.push({id:"Zeichenflaeche",n:h1,a:":"});
			
			inpWidth=new inputElement('breite','number',gruppe,'mm');
			inpWidth.setVal(Programmeinstellungen.drawoptions.blatt.width);
			inpWidth.setMinMaxStp(0,2000);//2m
			inpWidth.addEventFunc(changeElemente);
			
			
			inpHeight=new inputElement('hoehe','number',gruppe,'mm');
			inpHeight.setVal(Programmeinstellungen.drawoptions.blatt.height);
			inpHeight.setMinMaxStp(0,2000);
			inpHeight.addEventFunc(changeElemente);
			
			inpZoom=new inputElement('zoomfactor','number',gruppe);
			inpZoom.setVal(Programmeinstellungen.drawoptions.blatt.zoom);
			inpZoom.setMinMaxStp(0.1,5,0.1);
			inpZoom.addEventFunc(changeElemente);
			
			//gruppe=cE(werkznode,"article");
			//import/export
			label=cE(gruppe,"label",undefined,"butt");
			label.htmlFor="inputgcodesvg";
			label.innerHTML=getWort('loadgcode');
			translatetElements.push({id:"loadgcode",n:label});
			addClass(label,"openfilebutt");
			
			input=cE(gruppe,"input","inputgcodesvg","inputdatei");
			input.type="file";
			input.addEventListener("change",cangeInputloadgcode);
			
			inpbutt=new inputElement('importoption','button',gruppe);
			inpbutt.addEventFunc( function(v){ thedialog.showDialog('importeinstellungen'); } );//
			
			//input=cE(gruppe,"select");
			inpBeispiele=new inputElement('beispiele','select',gruppe);
			inpBeispiele.addListe(beispielliste);
			console.log(inpBeispiele);
			
			inpBeispiele.addEventFunc( function(v){ loadBeispiel(v);} );
			
			
			
			gruppe=cE(werkznode,"article");
			
			//Helperlein
			label=cE(gruppe,"label",undefined,"inputdateilabel butt");
			label.htmlFor="inputvorlageladen";
			label.innerHTML=getWort('loadvorlage');
			translatetElements.push({id:"loadvorlage",n:label});
			input=cE(gruppe,"input","inputvorlageladen","inputdatei");
			input.type="file";
			input.addEventListener("change",cangeInputvorlage);

			
			inpbutt=new inputElement('delvorlage','button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.delvorlage();} );
						
			div=cE(gruppe,"div",undefined,"block");
			inpbutt=new inputElement('opacity','range',div);
			inpbutt.setMinMaxStp(0,1,0.05);
			inpbutt.setVal(1);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.setVorlageTransparenz(v);} );
			
			
			gruppe=cE(werkznode,"article");
			h1=cE(gruppe,"h1");
			h1.innerHTML=getWort("werkzeug")+":";
			translatetElements.push({id:"werkzeug",a:":",n:h1});
			//Stift
			inpStaerke=new inputElement('Strichstaerke','number',gruppe,'mm');
			inpStaerke.setVal(0.5);
			inpStaerke.setMinMaxStp(0.01,10,0.01);
			inpStaerke.addEventFunc(changeElemente);
			
			//Werkzeugem unterschied per Farbe => Ebenen
			
			
			//viewoptions
			inpbutt=new inputElement('clearZeichnung','button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.clear();} );
			
			inpbutt=new inputElement('dellaststroke','button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.dellaststroke();} );
			
			inpShowgrid=new inputElement('showgrid','checkbox',gruppe);
			inpShowgrid.setVal(Programmeinstellungen.drawoptions.showgrid);
			inpShowgrid.addEventFunc(changeElemente);
			
			inpShowdots=new inputElement('showdots','checkbox',gruppe);
			inpShowdots.addEventFunc(changeElemente);
			
			inpShowdrawing=new inputElement('showdraw','checkbox',gruppe);
			inpShowdrawing.addEventFunc(changeElemente);
			
			//Optimierungen
			inpbutt=new inputElement('optimizestrokes','button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.optimizestrokes();} );
			
			
			gruppe=cE(werkznode,"article");
			h1=cE(gruppe,"h1");
			h1.innerHTML=getWort("ebenen")+":";
			translatetElements.push({id:"ebenen",a:":",n:h1});
			
			// aktiv [+]
			// (*) Ebene 1
			// ( ) Ebene 2
			// ( ) Ebene 3
			oEbenenElement=new Ebenenelement(gruppe);
			
			
			gruppe=cE(werkznode,"article");
			//Zeichnung actions: 
			h1=cE(gruppe,"h1");
			
			span=cE(h1,"span");
			span.innerHTML=getWort("Grafik")+"";
			translatetElements.push({id:"Grafik",a:"",n:span});
			
			input=new inputElement(undefined,'checkbox',h1);
			input.setClass("inlineblock abstandRL");
			input.addEventFunc(changeMofifiElemente);
			input.setdata(input);
			
			span=cE(h1,"span");
			span.innerHTML=getWort("ebenen")+":";
			translatetElements.push({id:"ebenen",a:":",n:span});
			
			
			node=cE(gruppe,"p");
			node.innerHTML=getWort("moveto")+":";
			translatetElements.push({id:"moveto",a:":",n:node});
			
			
			div=cE(gruppe,"div",undefined,"block verschieber");
			
			inpbutt=new inputElement('moveleft','button',div);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.moveto("L");} );
			inpbutt.setClass("movebutt moveL");
			
			inpbutt=new inputElement('moveright','button',div);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.moveto("R");} );
			inpbutt.setClass("movebutt moveR");
			
									
			inpbutt=new inputElement(undefined,'number',div,'mm');
			inpbutt.addEventFunc( function(v){zeichenfeld.setMovesteppsto(parseFloat(v))} );
			inpbutt.setClass("movestepps");
			inpbutt.setMinMaxStp(1,100,0.5);
			inpbutt.setVal(Programmeinstellungen.drawoptions.weitemm);
			
			
			
			inpbutt=new inputElement('movetop','button',div);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.moveto("T");} );
			inpbutt.setClass("movebutt moveT");
			
			inpbutt=new inputElement('movedown','button',div);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.moveto("D");} );
			inpbutt.setClass("movebutt moveD");
			
			
			//gruppe=cE(werkznode,"article");
			//Zeichnung actions: 
			node=cE(gruppe,"p");
			node.innerHTML=getWort("scale")+":";
			translatetElements.push({id:"scale",a:":",n:node});
			
			inpbutt=new inputElement('scaleless','button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.scale("-");} );
			inpbutt.setClass("minibutt scaleM");
			
			inpbutt=new inputElement('scalemore','button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.scale("+");} );
			inpbutt.setClass("minibutt scaleP");
			
			//TODO: rotate +-90°
			
			//Anzeige größe
			node=new InfoNodeElement(gruppe);
			
			
			gruppe=cE(werkznode,"article");
			h1=cE(gruppe,"h1");
			h1.innerHTML=getWort("controlandsave")+":";
			translatetElements.push({id:"controlandsave",a:":",n:h1});
			//Sprache
			var spliste=[];
			for(i=0;i<sprachen.length;i++){
				spliste.push(sprachen[i].language);
			}
			
			inpbutt=new inputElement('sprache','select',gruppe);
			inpbutt.addListe(spliste);
			inpbutt.setVal(Programmeinstellungen.sprache);
			inpbutt.addEventFunc( function(v){ 
							Programmeinstellungen.sprache=v;
							spracheaktiv=v;
							saveSettings();
							translateitems();
							} );
			
			//gcode Einstellungen
			inpbutt=new inputElement('einstllungengcode','button',gruppe);
			inpbutt.addEventFunc( function(v){thedialog.showDialog('einstellungen');} );
						
			//Grafik Speichern als gcode oder svg
			inpbutt=new inputElement('exportgcode','button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.exportgcode('gcode');} );
			
			inpbutt=new inputElement('exportsvg','button',gruppe);
			inpbutt.addEventFunc( function(v){if(zeichenfeld)zeichenfeld.exportgcode('svg');} );
			
			addClass(zielNode,"werkzeugeoffen");
			refreshInputElemente();
		}
		
		create();
	}
	
	var oZeichenfeld=function(ziel){
		var _this=this;
		var zeichnung=[];
		var strichepunkte=[];
		var basisnode;
		var canvasHG;
		var canvasVorlage;
		var canvasLines;
		var canvasZeichnung;
		var ladebalken,ladebalkenf;
		var canvasDraw;
		var rand=10;//px
		var apptitel="";
		var korr=0.5;
		var stiftsize=1;//mm
		var zommfactor=1;
		
		
		var mausXY={x:0,y:0,px:0,py:0};//cm|pixel
		var mausstat={
			"isdown":false,
			"lastpos":{x:0,y:0,px:0,py:0},
			"isstart":false
		}
		
		var zeichnungssize={
			minX:0,maxX:0,
			minY:0,maxY:0,
			width:0,
			height:0,
			isempty:true
		};
		
		//--API--
		this.setEbene=function(){
			showZeichnung();
		}
		
		
		this.getLineCount=function(){return zeichnung.length;}
		this.getPointCount=function(){
			var i,re=0;
			for(i=0;i<zeichnung.length;i++){
				re+=zeichnung[i].length;
			}
			return re;
			}
		this.getSize=function(){
			return zeichnungssize;
		}
			
		this.resize=function(){
			resizeZF();
		}
				
		this.clear=function(){
			//Zeichnung löschen
			clearSize();
			
			zeichnung=[];
			resizeZF();
			updateOutElemente();
		}
		
		this.dellaststroke=function(){
			var i,line,tempgrafik=[];
			
			if(zeichnung.length==0)return;
			for(i=0;i<zeichnung.length-1;i++){
				tempgrafik.push(zeichnung[i]);
			}
			zeichnung=tempgrafik;
			
			resizeZF();
			updateSize();
			updateOutElemente();
		}
		
		this.loadvorlage=function(dateiblob){
			loadVorlagenbild(dateiblob);
		}
		this.delvorlage=function(){
			loadVorlagenbild("");
		}
		
		this.deleteEbene=function(nr){
			var i,zneu=[],line,point;
			for(i=0;i<zeichnung.length;i++){
				
				line=zeichnung[i];
				point=line[0];
				if(point.level!=nr){
					if(nr<point.level){
						point.level=point.level-1;
					}
					zneu.push(zeichnung[i]);
				}
			}
			zeichnung=zneu;
		}
		
		var download=function(filename, daten) {
			var node = document.createElement('a');
			node.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(daten));
			node.setAttribute('download', filename);

			node.style.display = 'none';
			document.body.appendChild(node);

			node.click();

			document.body.removeChild(node);
		}
		
		this.exportgcode=function(exporttyp){
			//download ...
			var dateiname=Programmeinstellungen.dateiio.lastdateiname,
				data="";
			console.log("export als",dateiname);
			
			dateiname=window.prompt(getWort('inputfilename'),"dateiname."+exporttyp);
			if(dateiname===null)return;
			
			if(exporttyp=="svg"){
				data=getDataAsSVG();
				download(dateiname,data);				
			}
			else//gcode
			{	
				data=getDataAsGcode();
				download(dateiname,data);
			}
			Programmeinstellungen.dateiio.lastdateiname=dateiname;
			saveSettings();
			
		}
			
		var parsegcodeopt=function(s,data){
			if(s.indexOf("$sysinfo")>-1){
				var datum=new Date();
				s=s.split("$sysinfo").join("; "+datum);
			}
			if(s.indexOf("$movetoYmax")>-1){
				if(data && data["$movetoYmax"]!=undefined)
					s=s.split("$movetoYmax").join(data["$movetoYmax"]);
				else
					s=s.split("$movetoYmax").join("");
			}			
			if(s.indexOf("$movetoStart")>-1){
				if(data && data["$movetoStart"]!=undefined)
					s=s.split("$movetoStart").join(data["$movetoStart"]);
				else
					s=s.split("$movetoStart").join("");
			}
			s+="\n";
			return s;
		}
			
		var getDataAsGcode=function(){	
			var lz,pz,p,linie,xx,yy;
			var daten="; SplineWriter "+progversion+"\n";
			
			/*
			daten+="G21 ; set units to millimeters"+"\n";
			daten+="G90 ; use absolute coordinates"+"\n";
			daten+="\n";
			*/
			daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodeprestart); 
			
			
			var movespeed=Programmeinstellungen.gcodeoptionsV2.movespeed;
			var drawspeed=Programmeinstellungen.gcodeoptionsV2.drawspeed;
			
			var optspiegelnX=Programmeinstellungen.gcodeoptionsV2.spiegelX;
			var optspiegelnY=Programmeinstellungen.gcodeoptionsV2.spiegelY;
			
			var optnegativX=Programmeinstellungen.gcodeoptionsV2.negativX;
			var optnegativY=Programmeinstellungen.gcodeoptionsV2.negativY;
			
			var islaser=Programmeinstellungen.gcodeoptionsV2.gcodeLinienbegin.indexOf('M3')>-1;
			
			var yMul=1;
			var xMul=1;
			var yVersatz=0;//mm
			var xVersatz=0;//mm
			var maxXX=0;
			var maxYY=0;
			
			var maxX=0;//mm
			var maxY=0;//mm
			for(lz=0;lz<zeichnung.length;lz++){
				linie=zeichnung[lz];
				for(pz=0;pz<linie.length;pz++){
						p=linie[pz];
						if(p.x>maxX)maxX=p.x;
						if(p.y>maxY)maxY=p.y;
				}
			}
			if(optspiegelnY){
				yMul=-1;
				//yVersatz=maxY*10;
				yVersatz=werkzeuge.get("height");
			}
			if(optspiegelnX){
				xMul=-1;
				//xVersatz=maxX*10;
				xVersatz=werkzeuge.get("width");
			}
			
			
			
			daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodestart);
			
			var ebene,lastebene=-1;
			
			for(lz=0;lz<zeichnung.length;lz++){
				linie=zeichnung[lz];
				for(pz=0;pz<linie.length;pz++){
					p=linie[pz];
					
					//"; EBENE=1"
					if(p["level"]!=undefined){
						ebene=p["level"];
						if(lastebene!=ebene){
							daten+="; EBENE="+ebene+"\n";
							lastebene=ebene;
						}
					}
					
					xx=rundeauf(p.x*xMul+xVersatz,3);
					yy=rundeauf(p.y*yMul+yVersatz,3);
					if(xx>maxXX)maxXX=xx;
					if(yy>maxYY)maxYY=yy;
					if(optnegativX)xx=xx*-1;
					if(optnegativY)yy=yy*-1;
					
					if(pz==0){
						//moveTo
						daten+= "G1 X"+xx+" Y"+yy+" F"+movespeed;
						//if(islaser)daten+=" S0";//grbl = Frequenz
						daten+="\n";
						
						//Servo down/Laser an
						daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodeLinienbegin);
					}
					else{
						if(pz==1)
								daten+="G1 X"+xx+" Y"+yy+" F"+drawspeed;
							else
								daten+="G1 X"+xx+" Y"+yy;
						
						//if(islaser)daten+=" S1000";//grbl = Frequenz
						daten+="\n";
					}
				}
				if(linie.length>0){
					//Servo up; Laser Off
					daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodeLinienende);
				}
			}
			
			daten+=parsegcodeopt(Programmeinstellungen.gcodeoptionsV2.gcodeende,
							{
							 '$movetoYmax'	:"G1 X0 Y"+maxYY+" F"+movespeed,
							 '$movetoStart'	:"G1 X0 Y0 F"+movespeed
							}
							);
							
			daten+="\n";			
			daten+=";Projektpage: https://github.com/polygontwist/splinewriter";			
			daten+=";WebAPP: https://a-d-k.de/20200909_175137-SplinewriterWebApp.htm";			
			return daten;			
		}
		
		var getDataAsSVG=function(){
			var maxX=0,maxY=0,lz,linie,p,pz;
			var yVersatz=0;//mm
			var xVersatz=0;//mm
			
			var multiplikator_mm_to_px=64/22; //22->64
			
			var xMul=multiplikator_mm_to_px;
			var yMul=multiplikator_mm_to_px;
			
			var enr,data="";
			for(enr=0;enr<ebenenset.length;enr++){
				data+="<g id=\"Ebene_"+enr+"\">\n";
				//create lines
				for(lz=0;lz<zeichnung.length;lz++){
					linie=zeichnung[lz];//Line
					if(linie[0]["level"]==enr){
						data+="<polyline fill=\"none\" stroke=\""+ebenenset[enr]["color"]+"\" points=\"";
						for(pz=0;pz<linie.length;pz++){
								p=linie[pz];//Point
								if(p.x>maxX)maxX=p.x;
								if(p.y>maxY)maxY=p.y;
								if(pz>0)data+=" ";
								data+=rundeauf(p.x*xMul+xVersatz,3)+","+rundeauf(p.y*yMul+yVersatz,3);
						}
						
						data+="\" />\n";
					}
				}
				data+="</g>\n";				
			}
			
			
			
			//create header
			var headdata="<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
			headdata+="<!-- Generator: SplineWriter "+progversion+" -->\n";
			headdata+="<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n";
			headdata+="<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" width=\"";
			headdata+=(maxX*xMul)+"px\" height=\"";
			headdata+=(maxY*yMul)+"px\" viewBox=\"0 0 ";
			headdata+=(maxX*xMul)+" ";
			headdata+=(maxY*yMul)+"\" enable-background=\"new 0 0 ";
			headdata+=(maxX*xMul)+" ";
			headdata+=(maxY*yMul)+"\" xml:space=\"preserve\">\n";
						
			
			data+="\n</svg>";			
			return headdata+data;
		}
		
		this.importgcodesvg=function(filename,data){
			Programmeinstellungen.dateiio.lastdateiname=filename;
			clearSize();
			if(filename.indexOf('.gcode')>-1 
				||
				filename.indexOf('.nc')>-1 )
				loadGCode(filename,data);
			else
			if(filename.indexOf('.svg')>-1)
				loadSVG(filename,data);
			else
			if(filename.indexOf('.ai')>-1)
				loadAI(filename,data);
			else
				alert(getWort('notcorrectfile'));
		}
		
		
		this.setMovesteppsto=function(val){
			Programmeinstellungen.drawoptions.weitemm=val;
		}
		this.moveto=function(sRichtung){//L,R,T,D
			var i,line,pz,p,liste=zeichnung;
			var stepx=0;
			var stepy=0;
			var weitemm=Programmeinstellungen.drawoptions.weitemm;//mm
			if(sRichtung=="L")stepx=-1;
			if(sRichtung=="R")stepx=1;
			if(sRichtung=="T")stepy=-1;
			if(sRichtung=="D")stepy=1;
			
			if(!modifizierealles){
				liste=[];
				for(i=0;i<zeichnung.length;i++){
					line=zeichnung[i];
					p=line[0];
					if(p.level==ebenaktiv){
						liste.push(line);
					}
				}
			}
			
			for(i=0;i<liste.length;i++){
				line=liste[i];
				for(pz=0;pz<line.length;pz++){
					p=line[pz];
					p.x+=stepx*weitemm;
					p.y+=stepy*weitemm;
				}
			}
			
			resizeZF();
			updateOutElemente();
		}
		
		this.scale=function(pm){//"+","-"
			var i,line,pz,p,liste=zeichnung;
			var stepx=0;
			var stepy=0;
			var scalefactor=1;
			
			if(pm=="+")scalefactor=1/90*100;//110%
			if(pm=="-")scalefactor=0.9;//90%
			
			if(!modifizierealles){
				liste=[];
				for(i=0;i<zeichnung.length;i++){
					line=zeichnung[i];
					p=line[0];
					if(p.level==ebenaktiv){
						liste.push(line);
					}
				}
			}
			
			for(i=0;i<liste.length;i++){
				line=liste[i];
				for(pz=0;pz<line.length;pz++){
					p=line[pz];
					p.x=p.x*scalefactor;
					p.y=p.y*scalefactor;
				}
			}
			resizeZF();
			
			updateSize();
			updateOutElemente();
		}
		
		
		this.setVorlageTransparenz=function(v){
			canvasVorlage.style.opacity=v;
		}
		
		this.hatVorlage=function(){
			return canvasVorlage.hatVorlage;
		}
		
		this.optimizestrokes=function(){
			//Linien so sortieren das leerfahren sehr kurz sind

//TODO->bezier ->optimierung			

			//zeichnung[] ganze Zeichnung (array of Linie)
			//strichepunkte[] aktuelle Linie
			var iline,ipoint,linie;
			
			if(zeichnung.length<3)return;
			
			
			var sortlineEA=function(){
				var i,t,ie, linieA,linieB,pA,pB,pBe ,idA,idB,isadd, entfernung, id,
					templine,point,ebenelines,
					nexline={line:undefined,entfernung:undefined};
				var zeichnung_neu=[];
				
				var ignoreRichtung=false;
				
				if(!confirm(getWort("frageReverseLines"))){
					ignoreRichtung=true;
				}
				
				//Ebenen in seperate Arrays aufteilen
				var ebenenlinien=[];
				for(i=0;i<ebenenset.length;i++){
					ebenenlinien.push([]);
				}
				for(i=0;i<zeichnung.length;i++){
					linieA=zeichnung[i];
					point=linieA[0];
					ebenenlinien[point.level].push(linieA);
				}
				//jede Ebene optimieren
				for(ie=0;ie<ebenenlinien.length;ie++){
					ebenelines=ebenenlinien[ie];
					if(ebenelines.length>0){
						//1. Linien übernehmen, von da an weiter
						zeichnung_neu=[];
						linieA=ebenelines[0];
						pA=linieA[linieA.length-1];
						linieA[0].isadd=true;
						zeichnung_neu.push(linieA);
						
						for(i=0;i<ebenelines.length;i++){//alle Linien durchgehen
							nexline={line:undefined,entfernung:undefined,reverse:false};
							
							for(t=0;t<ebenelines.length;t++){//mit allen vergleichen
								linieB=ebenelines[t];
								pB=linieB[0];//erster Punkt
								pBe=linieB[linieB.length-1];//letzter Punkt
								isadd=linieB[0].isadd;
								if(!isadd){
									entfernung=streckenlaengePoint(pA,pB);
									
									if(nexline.entfernung==undefined){
										nexline.entfernung=entfernung;
										nexline.line=linieB;
										nexline.reverse=false;
									}
									else{
										if(entfernung<nexline.entfernung){
											nexline.entfernung=entfernung;
											nexline.line=linieB;
											nexline.reverse=false;
										}
										
										if(ignoreRichtung){//auf Endpunkt testen
											entfernung=streckenlaengePoint(pA,pBe);
											if(entfernung<nexline.entfernung){
												nexline.entfernung=entfernung;
												nexline.line=linieB;
												nexline.reverse=true;
											}
										}
									}
									
								}
							}
							
							if(nexline.line!=undefined){
								//Linie hinzufügen
								linieB=nexline.line;
								id=linieB[0].id;
								linieB[0].isadd=true;
								if(nexline.reverse){
									templine=[];
									for(t=0;t<linieB.length;t++){
										templine.push(linieB[linieB.length-1-t]);
									}
									linieB=templine;
								}
								linieB[0].id=id;
								linieB[0].isadd=true;		//auf übernommen setzen
								zeichnung_neu.push(linieB);
								
								//hinzugefügte Linie als neuen Ausgangspunkt setzen
								linieA=linieB;
								pA=linieA[linieA.length-1];
							}
							
						}
						//console.log('sortlineEA',zeichnung.length,zeichnung_neu.length);
						
						ebenenlinien[ie]=zeichnung_neu;
					}
				}
				
				
				zeichnung=[];
				for(ie=0;ie<ebenenlinien.length;ie++){
					ebenelines=ebenenlinien[ie];
					for(i=0;i<ebenelines.length;i++){
						zeichnung.push(ebenelines[i]);
					}
				}
				
				
			}
			
			for(iline=0;iline<zeichnung.length;iline++){
				linie=zeichnung[iline];//of points
				if(linie.length>0){
					linie[0].id="L"+iline;//ersten Punkt mit ID versehen
					linie[0].isadd=false; //für sortlineEA
				}
			}
			
			//nimm eine Linie und gucke welche andere am nächsten vom Endpunkt ist
			sortlineEA();
			
			resizeZF();//zeichnung neu auf Blatt malen
		}
		
		//--func--
		var setLadebalken=function(v){
			if(v==-1){
				addClass(ladebalken,"off");
				v=0;
				}
			else
				subClass(ladebalken,"off");
			
			ladebalkenf.style.width=v+"%";
		}
		
		var clearSize=function(){
			zeichnungssize={
				minX:0,maxX:0,
				minY:0,maxY:0,
				width:0,
				height:0,
				isempty:true
			};
		}
		var updateSizeLine=function(pointlist){
			var i,p;
			for(i=0;i<pointlist.length;i++){
				p=pointlist[i];
				if(zeichnungssize.isempty){
					zeichnungssize={
						minX:p.x,maxX:p.x,
						minY:p.y,maxY:p.y,
						width:0,
						height:0,
						isempty:false
					}
				}
				else{
					if(zeichnungssize.minX>p.x)zeichnungssize.minX=p.x;      
					if(zeichnungssize.maxX<p.x)zeichnungssize.maxX=p.x;      
					if(zeichnungssize.minY>p.y)zeichnungssize.minY=p.y;      
					if(zeichnungssize.maxY<p.y)zeichnungssize.maxY=p.y;
				}     
			}
			zeichnungssize.width=zeichnungssize.maxX-zeichnungssize.minX;
			zeichnungssize.height=zeichnungssize.maxY-zeichnungssize.minY;
		}
		var updateSize=function(linedata){
			var i,line;
			if(linedata==undefined){//Daten über alles sammeln
				clearSize();
				for(i=0;i<zeichnung.length;i++){
					updateSizeLine(zeichnung[i]);
				}
				//console.log(zeichnung);
			}else{
				//+neue Linie
				//console.log(linedata)
				updateSizeLine(linedata);
			}
		}
		
		//--maus/Tastatur--		
		//bei wacom leider anfangsphase ~ 5-8px als strich...
		var laststiftsize=1;
		var mausmove=function(e){
			var xy=relMouse(e,canvasDraw);
		
			var b=werkzeuge.get("width");//mm
			var cb=canvasHG.width;
			
			// /2->weniger jitter?
			//var x=b/cb*Math.floor(xy.x/1)*1;//px->mm
			//var y=b/cb*Math.floor(xy.y/1)*1;
			
			var x=Math.floor((b/cb*xy.x)*100)/100//px->mm  Genauigkeit: zwei Stellen hintern Komma
			var y=Math.floor((b/cb*xy.y)*100)/100;
			
			
			mausXY={x:x,y:y ,px:xy.x,py:xy.y,level:ebenaktiv};
			
			//apptitel
			var s="Position: x="+Math.floor(x*10)/10+"mm, y="		// /100-> 0.01mm
							+Math.floor(y*10)/10+"mm ";
			if(zeichnung.length>0)s+=""+zeichnung.length+" "+getWort("Striche");
			//if(mausstat.isdown)s+=" *";
			//document.title=s;
			
			statusleiste.printL(s);
			
			var lw=laststiftsize;
			
			if(mausstat.isdown){
				//zeichnen
				
				var cc=canvasDraw.getContext('2d');
				cc.strokeStyle=farbeStift;
				if(mausstat.isstart){
					lw=setStiftsizetopixel(cc);
					laststiftsize=lw;
					mausstat.isstart=false;
				}
				cc.beginPath();
				cc.moveTo(mausstat.lastpos.px, mausstat.lastpos.py);
				cc.lineTo(mausXY.px, mausXY.py);
				cc.stroke();
				
				//point
				if(werkzeuge.get("showdots")){
					var siz=lw*1;
					cc.fillStyle=farbepunkteStart;
					if(strichepunkte.length>0)
						cc.fillStyle=farbepunkte;
					cc.fillRect(mausXY.px+0.5-siz*0.5,mausXY.py+0.5-siz*0.5,siz,siz);
				}
				
				if(strichepunkte.length==0)
					strichepunkte.push(mausstat.lastpos);
				strichepunkte.push(mausXY);
			}
			
			mausstat.lastpos={x:x,y:y, px:xy.x,py:xy.y,level:ebenaktiv};
			
			e.preventDefault(); 
		}
		
		var mausdown=function(e){
			var cc=canvasDraw.getContext('2d');
			cc.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
			strichepunkte=[];
			mausstat.isdown=true;
			mausstat.isstart=true;
			mausmove(e);
			
			e.preventDefault(); 
		}
		var mausup=function(e){
			if(mausstat.isdown)createLinie();
			mausstat.isdown=false;
			mausstat.isstart=false;			
		}
		var mausout=function(e){
			if(mausstat.isdown)createLinie();
			mausstat.isdown=false;
		}
		
		
		var keydown=function(e){
			
			if(e.keyCode==90 && e.ctrlKey){//strg+z
				_this.dellaststroke();
				e.preventDefault(); 
			}
			//else console.log(e);
			
			
			if(e.keyCode==73){//i
				console.log("ebenaktiv",ebenaktiv);
				console.log(ebenenset);
				console.log(zeichnung);
			}
			
			/*if(e.keyCode==32 && !mausstat.isdown){
				
				var cc=canvasDraw.getContext('2d');
				cc.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
				strichepunkte=[];
				
				mausstat.isdown=true; 
			}*/
			
		}
		var keyup=function(e){
			/*if(e.keyCode==32){
				if(mausstat.isdown)createLinie();
				mausstat.isdown=false;
				}*/
			//e.preventDefault(); 
		}
		
		var resizeZF=function(e){
			if(werkzeuge!=undefined){				
				var b=werkzeuge.get("width");//mm
				var h=werkzeuge.get("height");//mm
				
				zommfactor=werkzeuge.get("zoom");
				if(isNaN(zommfactor))zommfactor=1;
				
				var bw=basisnode.offsetWidth -rand*2;
				var bh=basisnode.offsetHeight-rand*2;
				var canb=bw;
				var canh=bh;
				
				if(bw/b<bh/h){
					//breite=bw, höhe berechnen
					canh=canb/b*h;
					
				}else{
					//höhe=bh,breite berechen
					canb=canh/h*b;
				}
				canb=canb*zommfactor;
				canh=canh*zommfactor;
				
				canvasHG.width=canb;
				canvasHG.height=canh;
				
				canvasVorlage.width=canb;
				canvasVorlage.height=canh;
				
				canvasLines.width=canb;
				canvasLines.height=canh;
				
				if(werkzeuge.get("showgrid")){
					canvasLines.style.display="block";
				}else{
					canvasLines.style.display="none";
				}
				
				
				canvasZeichnung.width=canb;
				canvasZeichnung.height=canh;
				
				canvasDraw.width=canb;
				canvasDraw.height=canh;
				
				showHGMuster();
				showZeichnung();
			}			
		
			refreshInputElemente();
		}
		
		
		//--draw--
		var showHGMuster=function(){//Raster 1cm
			var cc=canvasLines.getContext('2d');
			cc.clearRect(0, 0, canvasLines.width, canvasLines.height);
			var x,y;
			
			var b=werkzeuge.get("width");//mm
			var stepp=canvasLines.width/b*10;//je 1cm
			
			cc.lineWidth=1;
			cc.strokeStyle="#badae9";
			
			for(x=0;x<canvasLines.width;x+=stepp){
				cc.beginPath();
				cc.moveTo(Math.floor(x)+korr,0);
				cc.lineTo(Math.floor(x)+korr,canvasLines.height);
				cc.stroke();
			}
			
			for(y=0;y<canvasLines.height;y+=stepp){
				cc.beginPath();
				cc.moveTo(0,Math.floor(y)+korr);
				cc.lineTo(canvasLines.width,Math.floor(y)+korr);
				cc.stroke();
			}
			
			werkzeuge.set("AnzahlStriche",zeichnung.length);
			
			//0-Punkt
			cc.lineWidth=4;
			cc.strokeStyle="#dd4444";
			x=0;
			cc.beginPath();
			cc.moveTo(Math.floor(x-stepp*0.25)+korr,0);
			cc.lineTo(Math.floor(x+stepp*0.25)+korr,0);
			cc.stroke();
			y=0;
			cc.beginPath();
			cc.moveTo(0,Math.floor(y-stepp*0.25)+korr);
			cc.lineTo(0,Math.floor(y+stepp*0.25)+korr);
			cc.stroke();
		}
		
				
		var setStiftsizetopixel=function(cc){
			//stiftsize=mm
			stiftsize=werkzeuge.get("linewidth");//mm
			
			var b=werkzeuge.get("width");//mm
			var stepp=canvasHG.width/b;//pixel je 1mm
			
			//console.log("stift",stepp*stiftsize,stepp,stiftsize);
			
			cc.lineWidth=stepp*stiftsize;
			cc.lineCap="round";
			cc.lineJoin="round";
			return stepp*stiftsize;
		}
	
		var vektorwinkel=function(p1,p2){
			
			var minx=Math.min(p1.x,p2.x);
			var miny=Math.min(p1.y,p2.y);
			var pp1={x:p1.x-minx,y:p1.y-miny};//auf 0/0 verschieben
			var pp2={x:p2.x-minx,y:p2.y-miny};
			
			var pp0={x:0,y:-5};
			
			/*
			var q=(pp2.y-pp1.y);
			if(q==0){
				q=1;
				//console.log((p2.x-p1.x),(p2.y-p1.y),"V",(p2.x-p1.x)/q,"*");
			}
			//else console.log((p2.x-p1.x),(p2.y-p1.y),"V",(p2.x-p1.x)/q);
			var vek=(pp2.x-pp1.x)/q;*/
			
			//Winkel Strecke p0-p1 zu p1-p2 in Grad
			var winkel=getWinkel([pp0.x,pp0.y],[pp1.x,pp1.y],[pp2.x,pp2.y],true);
			
			return winkel;
		}
		
		var Strichoptimieren=function(punkteliste){//auf x/y optimieren (übernahme wenn x/y passig)
			var i,p,pl,re=[],tmp=[],tmp2=[],abst,v,vDiffabs,lastv,pwl,winkel,p2;	
			
			if(punkteliste.length<2)return punkteliste;
			
			var abweichung=Programmeinstellungen.drawoptions.abweichung;//°Winkel
			var abstandmin=Programmeinstellungen.drawoptions.abstandmin;  //mm px?
			var grobabweichung=Programmeinstellungen.drawoptions.grobabweichung;
						
			//mindestabstand + winkel
			tmp.push(punkteliste[0]);//ersten
			pl=punkteliste[0];
			lastv=0;
			for(i=1;i<punkteliste.length-1;i++){
				p=punkteliste[i];
				abst=streckenlaenge2D([pl.x,pl.y],[p.x,p.y]);//mm			
//if(isNaN(abst)){console.log("##",punkteliste);}				
				pwl=punkteliste[i-1];//Punkt davor
				//Punkte Winkel
				p2=punkteliste[i+1]; //Punkt danach
				v=getWinkel([pl.x,pl.y],[p.x,p.y],[p2.x,p2.y],true);
				vDiffabs=Math.abs(v-lastv);
				//console.log(abst,v,Math.abs(v-lastv));
				
				
				if(	(abst>abstandmin && vDiffabs>0.1) ||  
					(vDiffabs>80 && vDiffabs<300)	
					){ 
					//<300 wegen +-180Flip
					tmp.push(p);
					pl=punkteliste[i];
				}
				lastv=v;
			}
			tmp.push(punkteliste[punkteliste.length-1]);//letzten
			
			re=tmp;
			
			//Länge ermitteln
			abst=0;
			for(i=1;i<re.length;i++){
				pl=re[i-1];
				p=re[i];				
				abst+=streckenlaenge2D([pl.x,pl.y],[p.x,p.y]);
			}
			
			return re;
		}
				
		var createLinie=function(newstrichoptimieren){
			//strichepunkte[] --> zeichnung + optimierung
			var cc=canvasDraw.getContext('2d');
			cc.clearRect(0, 0, canvasDraw.width, canvasDraw.height);
			
			if(strichepunkte.length<2)return;
			var AoptimierteLinie;
			if(newstrichoptimieren!==false){
				AoptimierteLinie=Strichoptimieren(strichepunkte);
				if(AoptimierteLinie.length<2)return;
			}else{
				AoptimierteLinie=strichepunkte;
			}
			
			cc=canvasZeichnung.getContext('2d');
			var i,p;
			var zline=[];
			//gezeichnete Linie in Zeichnung zeichnen
			var farbe=farbeZeichnungEbeneaktiv;
			if(AoptimierteLinie[0]["level"]!=undefined){
				if(ebenenset[AoptimierteLinie[0]["level"]]!=undefined)
					farbe=ebenenset[AoptimierteLinie[0]["level"]]["color"];
			}		
			cc.strokeStyle=farbe;
			
			setStiftsizetopixel(cc);
			cc.beginPath();
			for(i=0;i<AoptimierteLinie.length;i++){
				p=AoptimierteLinie[i];
				if(i==0)
					cc.moveTo(p.px+korr,p.py+korr);
				else
					cc.lineTo(p.px+korr,p.py+korr);
				
				zline.push(AoptimierteLinie[i]);
			}
			cc.stroke();
			
			//punkte einzeichnen
			cc.fillStyle=farbepunkteStart;
			if(werkzeuge.get("showdots"))
			for(i=0;i<AoptimierteLinie.length;i++){
				p=AoptimierteLinie[i];
				if(i==1)
					cc.fillStyle=farbepunkte;
					
				cc.fillRect(p.px+korr-1,p.py+korr-1,3,3);
			}
			
			zeichnung.push(zline);
			updateSize(zline);
			
			refreshInputElemente();
			updateOutElemente();
		}
		
		var timer=undefined;
		var showZeichnung=function(){//transformLinie x/y zu px/py
			if(timer!=undefined)clearTimeout(timer);
			var cc=canvasZeichnung.getContext('2d');
			cc.clearRect(0, 0, canvasZeichnung.width, canvasZeichnung.height);
			var iline,ip,line,p,xx,yy;
			
			var b=werkzeuge.get("width");//mm
			var cb=canvasHG.width;//Pixel
			
			var MulmmToPix=cb/b;
			var wait=0;
			
			
			setStiftsizetopixel(cc);
			
			//console.log(">",zeichnung);
			var posline=0;
			
			var zeichnen=function(){
				var ip,p,xx,yy;
				var zeichenebene=zeichnung;
				
				if(timer!=undefined)clearTimeout(timer);
				if(zeichenebene.length==0)return;
				
				cc.strokeStyle=farbeZeichnung;
				
				line=zeichenebene[posline];
				if(line[0]!=undefined){
					ip=line[0]["level"];
					
					if(line[0]["level"]===ebenaktiv)
						cc.strokeStyle=farbeZeichnungEbeneaktiv;
					
					
					if(ebenenset[ip]!=undefined)
						cc.strokeStyle=ebenenset[ip]["color"];
				}
				
				cc.beginPath();
				
				for(ip=0;ip<line.length;ip++){
					p=line[ip];
					//cm->pixel
					xx=(p.x*MulmmToPix);
					yy=(p.y*MulmmToPix);
					
					if(ip==0)
						cc.moveTo(xx+korr,yy+korr);
					else
						cc.lineTo(xx+korr,yy+korr);
				}
				cc.stroke();
				//punkte einzeichnen
				cc.fillStyle=farbepunkteStart;
				if(werkzeuge.get("showdots"))
					for(ip=0;ip<line.length;ip++){
						p=line[ip];
						xx=(p.x*MulmmToPix);
						yy=(p.y*MulmmToPix);
						if(ip==1)cc.fillStyle=farbepunkte;
						cc.fillRect(xx+korr-1,yy+korr-1,3,3);
					}
				
				posline++;
				if(posline<zeichenebene.length){
					if(wait>0)
						timer=setTimeout( function(){zeichnen()} ,wait);
					else
						zeichnen();
				}
			}
			
			if(werkzeuge.get("showdraw")){
				wait=Math.floor(1/zeichnung.length*10000*2);
				if(wait==0)wait=1;
				if(wait>20)wait=20;
			}
			zeichnen();
			updateOutElemente();
		}
		
		//--datei IO--
		var loadVorlagenbild=function(dateiblob){
			console.log("##",dateiblob);
			canvasVorlage.style.backgroundImage="url("+dateiblob+")";
			canvasVorlage.hatVorlage=dateiblob!="";
			refreshInputElemente();
		}
		
		
		
		var rundeauf=function(val,stellen){
			var i,st=1;
			for(i=0;i<stellen;i++){
				st=st*10;
			}
			return Math.floor(val*st)/st;
		}
		
		var calcytimer;
		
		var loadGCode=function(fileName,daten){
			if(fileName=="")return;
			Programmeinstellungen.dateiio.lastdateiname=fileName;
			setLadebalken(0);
			if(calcytimer!=undefined)clearTimeout(calcytimer);
			var i,t,linie,s,zeile,bef,value,p,sval,tmp,ozeile,
				xx=0,
				yy=0,
				zz=0,
				staerke=1000,//"S123" optional
				feedrate=0,
				ee;
			
			var factorToMM=1;//Quelle=mm
			
			var hatExtruder=false;
			var isLaser=false;		//oder Motor
			var isline=true;
			
			var yMul=1,xMul=1,yVersatz=0,xVersatz=0;
			if(Programmeinstellungen.gcodeoptionsV2.spiegelY){
				yMul=-1;
				yVersatz=werkzeuge.get("height");
			}
			if(Programmeinstellungen.gcodeoptionsV2.spiegelX){
				xMul=-1;
				xVersatz=werkzeuge.get("width");
			}
			
			if(zeichnung.length>0)
			if( confirm(getWort("zeichnungloeschen"))){
				zeichnung=[];//of Lines
			}
			
			linie=[];
			
			var dlist=daten.split('\n');
			var ebenennummer=ebenaktiv;
//TODO: freie gcodes -> Erkennung anpassen ? (Linienfarbe = ServoNr ?)
			for(i=0;i<dlist.length;i++){
				zeile=dlist[i].split('\n').join('');
				ozeile=zeile;
				zeile=zeile.split('\r').join('');
				zeile=zeile.toUpperCase().split(';')[0].split(' ').join('')+';';
				
				s=dlist[i].split(';')[0].toUpperCase().split(" ");
				//console.log(s);
				setLadebalken(100/dlist.length*i);
			
				//"; EBENE=1"
				if(ozeile.indexOf("EBENE=")>-1){
					tmp=parseInt(ozeile.split("EBENE=")[1]);
					if(!isNaN(tmp)){
						if(tmp>-1){
							ebenennummer=tmp;
							while(ebenenset.length<ebenennummer+1){
								oEbenenElement.addEbene({"name":"","color":farbeZeichnung})
							}
						}
					}
				}
			
				if(s[0]=="G90" || zeile.indexOf("G90;")==0){} //absolute Position
				
				if(s[0]=="G20" || zeile.indexOf("G20;")==0)factorToMM=25.4; //inch to mm
				if(s[0]=="G21" || zeile.indexOf("G21;")==0)factorToMM=1; 	//mm
				
				if(s[0]=="M280"){//Servo
					for(t=1;t<s.length;t++){// M280 P0 S110
						bef=s[t];
						value=parseInt(bef.slice(1));
						
						if(bef.indexOf('P')==0){}//Servoport
						
						if(bef.indexOf('S')==0){//Position (0=down)
							if(value==0){//Programmeinstellungen.gcodeoptions.servoDown-ist immer 0
								linie=[];// new Line
								linie.push({x:xx,y:yy,px:0,py:0,level:ebenennummer});//Ausgangspunkt
								isline=true;
							}else{//UP
								if(linie.length>0)zeichnung.push(linie);
								linie=[];
								isline=false;
								
							}
						}
					}
				}
				
				if(s[0]=="G92"){//Set Position
					if(s[1]=="E0"){
						hatExtruder=true;
						if(linie.length>0)zeichnung.push(linie);
						linie=[];
					}
				}
				
				if(s[0]=="M3" || s[0]=="M4"
						|| zeile.indexOf("M3;")==0
						|| zeile.indexOf("M4;")==0
					){//Spindle On, Clockwise|Counter-Clockwise
					isLaser=true;		
					isline=true;
					linie=[];
					linie.push({x:xx,y:yy,px:0,py:0,level:ebenennummer});//add Point, aktuelle Position
				}
				if(s[0]=="M5" || zeile.indexOf("M5;")==0){//Spindle Off
					isLaser=true;
					isline=false;
					if(linie.length>1)zeichnung.push(linie);
					linie=[];
				}
				
				if(s[0]=="G1"){
					if(hatExtruder){isline=false;}
					for(t=1;t<s.length;t++){//Einzelwerte parsen
						bef=s[t];
						value=parseFloat(bef.slice(1));
						if(bef.indexOf('X')==0){
							xx=rundeauf(value*factorToMM*xMul+xVersatz,3);//rundeauf drei Kommastellen
						}
						if(bef.indexOf('Y')==0){
							yy=rundeauf(value*factorToMM*yMul+yVersatz,3);
						}
						if(bef.indexOf('Z')==0){zz=value*factorToMM;}
						
						if(bef.indexOf('S')==0){staerke=value;}//gbrl Stärke
						if(bef.indexOf('F')==0){feedrate=value;}//feedrate per minute
						
						if(bef.indexOf('E')==0){//extrude
							hatExtruder=true;
							value=bef.slice(1);
							if(value.indexOf(':')>-1)value=value.split(':')[0];
							
							if(value<=0){
								isline=false;
							}else{
								isline=true;
							}
						}
					}
					
					if(isLaser){
						if(staerke<1){
							isline=false;
						}
						else{
							isline=true;
						}
					}
					
					
					if(isline){
							linie.push({x:xx,y:yy,px:0,py:0,level:ebenennummer});//add Point
						}
						else{
							if(hatExtruder){
								if(linie.length>0)zeichnung.push(linie);
								linie=[];
							}
							if(isLaser){
								if(linie.length>1)zeichnung.push(linie);
								linie=[];
								linie.push({x:xx,y:yy,px:0,py:0,level:ebenennummer});//1. Point
							}
						}
				}
			}
			
			//Zeichnung checken, bei negativen Koordinaten, neu ausrichten
			var minX=0,maxX=0,minY=0,maxY=0;
			for(i=0;i<zeichnung.length;i++){//minXY holen - fals Zeichnung im negativen Bereich liegt
				for(t=0;t<zeichnung[i].length;t++){
					p=zeichnung[i][t];
					if(p.x<minX)minX=p.x;
					if(p.x>maxX)maxX=p.x;
					if(p.y<minY)minY=p.y;
					if(p.y>maxY)maxY=p.y;
				}
			}
			if(minX<0 || minY<0){
				//Zeichnung repositionieren, aus dem negativen Bereich in den positiven
				for(i=0;i<zeichnung.length;i++){
					for(t=0;t<zeichnung[i].length;t++){
						p=zeichnung[i][t];
						p.x+=(minX*-1);
						p.y+=(minY*-1);
					}
				}
			}
			minX=maxX;
			minY=maxY;
			for(i=0;i<zeichnung.length;i++){//min/max holen
				for(t=0;t<zeichnung[i].length;t++){
					p=zeichnung[i][t];
					if(p.x<minX)minX=p.x;
					if(p.x>maxX)maxX=p.x;
					if(p.y<minY)minY=p.y;
					if(p.y>maxY)maxY=p.y;
				}
			}
			
			if(maxX>werkzeuge.get("width")) {
				werkzeuge.set("width",Math.round(maxX+0.5));
			}//mm
			if(maxY>werkzeuge.get("height")){
				werkzeuge.set("height",Math.round(maxY+0.5));
			}//mm
			
			setLadebalken(100);
			resizeZF();
			setLadebalken(-1);
			
			updateSize();
			updateOutElemente();
		}
		
		
		var getLineColorbyClass=function(svg,node){
			var i;
			var class0=node.getAttribute("class").split(' ')[0];
			var cStyle = svg.getElementsByTagName("style")[0];
			
			if(cStyle!=undefined){
				var str=cStyle.innerHTML.split("\t").join('');//Tab entfernen
				var zeilen=str.split("\n");
				for(i=0;i<zeilen.length;i++){
					if(zeilen[i].indexOf("."+class0)>-1){
						if(zeilen[i].indexOf("stroke:")>-1){
							str=zeilen[i].split("stroke:")[1];
							if(str.indexOf(";")>-1){
								str=str.split(";")[0];
							}
							if(str.indexOf("#")==0)
								return str;
						}
					}
				}				
			}			
			return ebenenset[ebenaktiv]["color"];			
		}
		
		var loadSVG=function(fileName,daten){
			
			if(zeichnung.length>0)
			if( confirm(getWort("zeichnungloeschen"))){
				_this.clear();//alte Zeichnung löschen
			}
			
			setLadebalken(1);
			if(calcytimer!=undefined)clearTimeout(calcytimer);
			
			//var DOMURL = window.URL || window.webkitURL || window;
			var i,t,pfad,pl,property,svgpoint,drawline;
			Programmeinstellungen.dateiio.lastdateiname=fileName.split('.svg').join('.gcode');
			
			var blattwidth=werkzeuge.get("width");
			var blattheight=werkzeuge.get("height");
			
			var scalieren=false;
			
			//Pfade aufsplitten
			if(daten.indexOf("M")>-1){
				console.log("trenne Pfade");
				daten=daten.split("M").join("\"/><path stroke=\"#000000\" d=\"M");
			}
			//Pfade trennen
			// :-/ klappt nicht immer
			/*if(1==0)
			if(daten.indexOf(' d="')>-1){
				var p,strL,dlist=daten.split(' d="'),zlist;
				for(i=1;i<dlist.length;i++){
					
					strL=dlist[i].split('"');//Teil bis 'd'-zugeht
					if(strL[0].indexOf('z')>-1){
						zlist=strL[0].split('z');//Teilstücke
						
						var firstm=zlist[0];//mXX.X,YY ->"," "c", ...
						var pkomma=firstm.indexOf(',');
						var pe=pkomma;
						for(t=pkomma+1;t<firstm.length;t++){
							//48..57=zahl
							//44=,
							//46=.
							//45=-
							//32=space
							if( firstm.charCodeAt(t)!=45
								&&
								firstm.charCodeAt(t)!=46
								//&& firstm.charCodeAt(t)!=32
								&&
								(
								firstm.charCodeAt(t)<48
								||
								firstm.charCodeAt(t)>57
								)
								
							){
								pe=t;
								break;
							}
						}
						firstm=firstm.substring(0,pe);
						
						for(t=1;t<zlist.length-1;t++){
							zlist[t]='"/>\n<path d="'+firstm+zlist[t];
						}
						strL[0]=zlist.join('z');
						dlist[i]=strL.join('"');
					}
					//console.log(">>>>",firstm);
					//console.log(zlist);
					
				}
				daten=dlist.join(' d="');
				//console.log(daten.split(' d="'));
			}
			*/
			
			var svgdoc=document.createElement('svg');
			svgdoc.innerHTML=daten;
			
			//console.log(daten);
			//
			//	m/M x y =moveto
			//	l/L=draw line to
			//	h/H=horizontal line to
			//	v/V=vertical line to
			//	c/C=Cubic Béziers
			//	s/S=Several Bézier
			//	q/Q=quadratic curve
			//	t/T=multiple quadratic Béziers
			//	a/A=Kurven
			//	z/Z=Close Path
			/*var pfade=svgdoc.getElementsByTagName("path");
			//pfad d="..."
			//Pfade auftennen
			for(i=0;i<pfade.length;i++){
				
			}
			*/
			
			var info=svgdoc.getElementsByTagName('svg')[0];
			console.log("svg version",info.getAttribute("version"));
			
			if(info.getAttribute("viewBox")==null){
				info.setAttribute("viewBox","0 0 "+info.getAttribute("width")+" "+info.getAttribute("height"));
			}
			console.log("viewBox",info.getAttribute("viewBox"));//0 0 800 600
			
			var sarr=info.getAttribute("viewBox").split(' ');
			
			var dbox={"x":sarr[0],"y":sarr[1],"width":sarr[2],"height":sarr[3]};
			
			if(!confirm(getWort("scaletoblatt"))){
				//Blatt scalieren
				blattwidth=Math.floor(dbox.width/72*25.4);
				blattheight=Math.floor(dbox.height/72*25.4);
				werkzeuge.set("width",blattwidth);
				werkzeuge.set("height",blattheight);
				resizeZF();
			}else{
				//scalieren auf document oder 72dpi (mm=px/72dpi*25,4mm)
				scalieren=true;
			}
			
			
			var pxtommMul=Math.min(blattheight/dbox.height, blattwidth/dbox.width);
			
			var mulScaleDraw=Math.min(canvasZeichnung.height/dbox.height, canvasZeichnung.width/dbox.width);
			
			//console.log("mul?",blattheight/dbox.height,blattwidth/dbox.width);
			//console.log("mul>",pxtommMul);
			
			
			//https://developer.mozilla.org/en-US/docs/Web/API/SVGGeometryElement/getPointAtLength
			
			var soz,pfade,polyline,polygone,gesammtobjekte;
			var strichobjekte=['path','line','rect'];//ansich gehen nur Pfade...
			var xmin=dbox.width,xmax=0;
			var ymin=dbox.height,ymax=0;
			var tmp;
			
			if(scalieren===false){
				xmin=0;
				ymin=0;
				xmax=dbox.width;
				ymax=dbox.height;
			}
			console.log("scalieren",scalieren);
			
			var calcfunnr=-1;
			var schleifenz=0;
			
			var LinesToPolypaht=function(SVGdoc){
				var re=[],i,newNode, x1,y1,x2,y2;
				var lines=SVGdoc.getElementsByTagName('line');
				
				//<line fill="none" stroke="#000000" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round" x1="144.275" y1="369.835" x2="144.075" y2="346.735"/>
				//->
				//<polyline fill="none" stroke="#000000" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round" points="142.175,406.735 142.175,406.735 142.175,406.535"/>
				for(i=0;i<lines.length;i++){
					x1=lines[i].getAttribute("x1");
					y1=lines[i].getAttribute("y1");
					x2=lines[i].getAttribute("x2");
					y2=lines[i].getAttribute("y2");
					if(
						isNaN(parseFloat(x1)) || isNaN(parseFloat(x2)) ||
						isNaN(parseFloat(y1)) || isNaN(parseFloat(y2)) 
					){
						
					}
					else{
						newNode=document.createElement("polyline");
						newNode.setAttribute("points",x1+','+y1+' '+x2+','+y2);
						SVGdoc.appendChild(newNode);
					}
				}
				return re;
			}
			
			var calcpfade=function(){
					var ez,gefunden=false,linecolor="";
				
					if(calcytimer!=undefined)clearTimeout(calcytimer);
					var point,attr,ip,liste,node,strp,newnode,x,y,w,h,points;
					if(calcfunnr==-1){//get pfade/polyline
						//Linien zu polyline
						LinesToPolypaht(svgdoc);
						
						pfade=svgdoc.getElementsByTagName('path');
						polyline=[];
						liste=svgdoc.getElementsByTagName('polyline');
						for(ip=0;ip<liste.length;ip++){
							polyline.push(liste[ip]);	
						}
						liste=svgdoc.getElementsByTagName('polygon');//+
						for(ip=0;ip<liste.length;ip++){
							node=liste[ip];
							points=node.getAttribute("points").split(' ');
							points.push(points[0]);//ersten als letzten Punkt hinzufügen
							points=points.join(' ').split('  ').join(' ');
							
							node.setAttribute("points",points);
							polyline.push(node);	
						}
						
						//<rect x="127.529" y="85.875" fill="none" stroke="#74FF00" width="1.813" height="11.938"/>
						//in Polyline umwandeln
						liste=svgdoc.getElementsByTagName('rect');
						for(ip=0;ip<liste.length;ip++){
							node=liste[ip];
							x=parseFloat(node.getAttribute("x"));
							y=parseFloat(node.getAttribute("y"));
							w=parseFloat(node.getAttribute("width"));
							h=parseFloat(node.getAttribute("height"));
							strp=x+','+y+' '		//0/0
								+(x+w)+','+y+' '	//rechts
								+(x+w)+','+(y+h)+' '//runter
								+(x)+','+(y+h)+' '	//links
								+(x)+','+(y)+' '		//hoch
								;
							newnode=document.createElement("polygon");
							newnode.setAttribute("points",strp);
							polyline.push(newnode);	
							
							//console.log(polyline.length,newnode.getAttribute("points"));
						}
						
						
						//<polygon points="246.578,10.969 231.64,16.344 231.64,20.031 236.577,18.25 236.577,29.375 246.577,25.813 246.577,10.969 "/>
						
						
						gesammtobjekte=pfade.length+polyline.length;
						if(gesammtobjekte==0){
									alert(getWort("notpfade"));
									return;
								}
						//console.log("gesammtobjekte",gesammtobjekte);
						//<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="80.83px" height="17.27px" viewBox="0 0
						
						schleifenz=0;
						calcfunnr=0;
					}
					
					if(calcfunnr==0){//get min/max								
								
						i=schleifenz;
						
						if(i<pfade.length){
							//<path>
							pfad=pfade[i];//.getAttribute('d')

							if(typeof pfad.getTotalLength !=="undefined"){
								pl=pfad.getTotalLength();									
								//console.log("pflength",pl);
								for(t=0;t<pl;t++){
									point=pfad.getPointAtLength(t);
									xmin=Math.min(point.x,xmin);
									ymin=Math.min(point.y,ymin);
									xmax=Math.max(point.x,xmax);
									ymax=Math.max(point.y,ymax);
								}
							}else{
								console.log("#>",pfad);
							}
						}
						else{
							//<polyline>
							pfad=polyline[i-pfade.length];
							attr=pfad.getAttribute('points');
							
							attr=attr.split("\t").join('');
							attr=attr.split("\r").join('');
							attr=attr.split("\n").join('');
							attr=attr.split("  ").join('');
							
							pfad.setAttribute("points",attr);
							
							pl=attr.split(' ');
							for(t=0;t<pl.length;t++){
								if(pl[t].indexOf(',')>-1){
									point=pl[t].split(',');
									if(isNaN(parseFloat(point[0])) || isNaN(parseFloat(point[1]))){		
										//leerzeichen	
										//console.log(">>",attr,pl,point);
									}
									else{
										xmin=Math.min(parseFloat(point[0]),xmin);
										ymin=Math.min(parseFloat(point[1]),ymin);
										xmax=Math.max(parseFloat(point[0]),xmax);
										ymax=Math.max(parseFloat(point[1]),ymax);
									}
								}								
							}
						}
						
						setLadebalken(50/gesammtobjekte*i);
						
						schleifenz++;
						if(schleifenz==gesammtobjekte){
							calcfunnr=1;
							schleifenz=0;
						}
							
					}
					else
					if(calcfunnr==1){//grafik auf Blattformat scalieren
						setLadebalken(50);
						console.log('minmax',xmin,xmax,ymin,ymax);
						
						tmp=Math.min(blattwidth/(xmax-xmin), blattheight/(ymax-ymin));
						if(pxtommMul<tmp){
							pxtommMul=tmp;
							mulScaleDraw=Math.min(canvasZeichnung.height/(xmax-xmin), canvasZeichnung.width/(ymax-ymin));
						}
						
						console.log("scaleto",pxtommMul,mulScaleDraw);//,tmp,blattwidth/(xmax-xmin),blattheight/(ymax-ymin),Programmeinstellungen);
						schleifenz=0;
						calcfunnr=2;	
						
					}
					else
					if(calcfunnr==2){//zeichnen
							i=schleifenz;
							
							if(i<pfade.length){//console.log("path",i);
								//path
								pfad=pfade[i];//.getAttribute('d')
								
								if(typeof pfad.getTotalLength !=="undefined"){
									pl=pfad.getTotalLength();
									if(pl>0){
										//console.log('length',pl,pfad);
										strichepunkte=[];
										setLadebalken(50+50/pfade.length*i);								
										//for(t=0;t<pl;t+=0.5)
										for(t=0;t<pl;t++)
										{
											point=pfad.getPointAtLength(t);
											strichepunkte.push({
												x:(point.x-xmin)*pxtommMul,//mm
												y:(point.y-ymin)*pxtommMul, 
												px:(point.x-xmin)*mulScaleDraw,//pixel
												py:(point.y-ymin)*mulScaleDraw,
												level:ebenaktiv
												})
										}
										point=pfad.getPointAtLength(pl-0.01);
										strichepunkte.push({
												x:(point.x-xmin)*pxtommMul,
												y:(point.y-ymin)*pxtommMul, 
												px:(point.x-xmin)*mulScaleDraw,
												py:(point.y-ymin)*mulScaleDraw,
												level:ebenaktiv
												})
										
										//console.log(strichepunkte);
										createLinie(true);//zeichnet px/py,optimiert auf x/y aus strichepunkte
									}
								}
							}
							else{//console.log("polyline",i);
								//polyline
								strichepunkte=[];
								pfad=polyline[i-pfade.length];
								var zielebene=ebenaktiv;
								
								linecolor=ebenenset[ebenaktiv]["color"];
								if(pfad.getAttribute("stroke")!=undefined){
									linecolor=pfad.getAttribute("stroke");
									if(linecolor=="none")linecolor=ebenenset[ebenaktiv]["color"];
									//suche in ebenen nach passender Farbe
								}
								else
								if(pfad.getAttribute("class")!=undefined){
									linecolor=getLineColorbyClass(svgdoc,pfad);
								}
								
								
								for(ez=0;ez<ebenenset.length;ez++){
									if(ebenenset[ez]["color"].toUpperCase()==linecolor.toUpperCase()){
										zielebene=ez;
										gefunden=true;
									}
								}
								if(!gefunden){
									//neue Ebene
									oEbenenElement.addEbene({"name":"","color":linecolor});
									zielebene=ebenenset.length-1;
								}
								
								
								pl=pfad.getAttribute('points').split(' ');//console.log(pl);
								for(t=0;t<pl.length;t++){
									if(pl[t].indexOf(',')>-1){
										point=pl[t].split(',');
										if(isNaN(parseFloat(point[0])) || isNaN(parseFloat(point[1])) ){
											
										}
										else{
											//console.log(point);
											strichepunkte.push({
												x:(parseFloat(point[0])-xmin)*pxtommMul,
												y:(parseFloat(point[1])-ymin)*pxtommMul, 
												px:(parseFloat(point[0])-xmin)*mulScaleDraw,
												py:(parseFloat(point[1])-ymin)*mulScaleDraw,
												level:zielebene
												});
											
										}
									}	
								}
								createLinie(false);//Optimierung gibt Fehler bei rechteckgrafiken!
							}
							
							
							schleifenz++;
							if(schleifenz==gesammtobjekte){
								calcfunnr=3;
								schleifenz=0;
							}
					}
					else
					if(calcfunnr==3){//fertig
						setLadebalken(100);
						resizeZF();
						setLadebalken(-1);
						calcfunnr=4;
						
						console.log("Linien",_this.getLineCount(),"Punkte",_this.getPointCount());
						blattwidth=werkzeuge.get("width");
						blattheight=werkzeuge.get("height");
						console.log("Blatt",blattwidth,"x",blattheight,'mm²');
					}
					
					if(calcfunnr<4){
						calcytimer=setTimeout(calcpfade,1);
					}
			}
			
			
			//start Liniengenerierung
			calcpfade();
			
		}
		
		//--------------------ai--------------------
		const cubicBezier=function(p0, p1, p2, p3, t) {
				const x = Math.pow(1 - t, 3) * p0[0] +
						  3 * Math.pow(1 - t, 2) * t * p1[0] +
						  3 * (1 - t) * Math.pow(t, 2) * p2[0] +
						  Math.pow(t, 3) * p3[0];

				const y = Math.pow(1 - t, 3) * p0[1] +
						  3 * Math.pow(1 - t, 2) * t * p1[1] +
						  3 * (1 - t) * Math.pow(t, 2) * p2[1] +
						  Math.pow(t, 3) * p3[1];

				return [x, y];
			}

		const flattenBezier=function (p0, p1, p2, p3, stepSize = 2) {
				const points = [];
				const steps = 100; // high enough for smoothness

				let last = p0;
				points.push(last);

				for (let i = 1; i <= steps; i++) {
					const t = i / steps;
					const pt = cubicBezier(p0, p1, p2, p3, t);
					const dx = pt[0] - last[0];
					const dy = pt[1] - last[1];
					const dist = Math.sqrt(dx * dx + dy * dy);

					if (dist >= stepSize) {
						points.push(pt);
						last = pt;
					}
				}

				return points;
		}
			
			
		var loadAI=function(filename,data){
			var i,k,zeile,scfactor=1,scfacpx=1,dbox;
			//y negieren!
			//console.log("loadAI",filename,data);
			if(zeichnung.length>0)
				if( confirm(getWort("zeichnungloeschen"))){
					_this.clear();//alte Zeichnung löschen
				}
			setLadebalken(1);
			if(calcytimer!=undefined)clearTimeout(calcytimer);
				
			Programmeinstellungen.dateiio.lastdateiname=filename.split('.ai').join('.gcode');

			var blattwidth=werkzeuge.get("width");
			var blattheight=werkzeuge.get("height");
			dbox={x:0,y:0,width:blattwidth,height:blattheight};
			
			var scalieren=false;
			var shapes = []; // Liste für alle Formen
			var currentShape = []; // Aktuelle Form
			var isNewShape = true;

			var calcfunnr=0;
			var schleifenz=0;
			
			const calcpfade=function(){
				
				if(calcfunnr==0){
					var zeilen=data.split("\r");
					for(i=0;i<zeilen.length;i++){
						zeile=zeilen[i].trim();
						
						if(zeile.indexOf("%%BoundingBox")>-1){
							//%%BoundingBox: 0 0 367 350
							//129 123
							var bbox=zeile.split(":")[1].trim();
							var bboxarr=bbox.split(" ");
							dbox={"x":parseFloat(bboxarr[0]),"y":parseFloat(bboxarr[1]),"width":parseFloat(bboxarr[2]),"height":parseFloat(bboxarr[3])};
							
							scfacpx=1/72*25.4;
							
							
							if(!confirm(getWort("scaletoblatt"))){//no
								//367px 72dpi=129.5mm
								blattwidth=Math.floor(dbox.width	/72*25.4);//mm
								blattheight=Math.floor(dbox.height	/72*25.4);
								werkzeuge.set("width",blattwidth);
								werkzeuge.set("height",blattheight);
								resizeZF();
							}else{//yes
								scalieren=true;
								var b=Math.floor(dbox.width/72*25.4);//mm 129mm
								scfactor=1/b*blattwidth;
							}
						}

						// Formen erkennen
						if(zeile.endsWith("m") || zeile.endsWith("L") || zeile.endsWith("c") || zeile.endsWith("C")|| zeile.endsWith("l")) {
							//m=moveTo
							//c=curve
							//L=line
							
							var coords = zeile.split(" ");
							var x = parseFloat(coords[0]);
							var y = parseFloat(coords[1]);			
							if(isNewShape) {
								currentShape = [];
								isNewShape = false;
							}
							
							//109.1812 315 129.9999 294.1812 129.9999 268.5 c curve
							
							if(zeile.endsWith("c")||zeile.endsWith("C")){
								currentShape.push({
									cp1: [parseFloat(coords[0]), parseFloat(coords[1])]
									,cp2: [parseFloat(coords[2]), parseFloat(coords[3])]
									, to: [parseFloat(coords[4]), parseFloat(coords[5])]
									,type: "curve"
								});
							}
							else{
								currentShape.push({
									x: x,
									y: y,
									type: zeile.endsWith("m") ? "move" : "line"
								});
							}
						}
						if(zeile.endsWith("n") || zeile.endsWith("N")){
							if(currentShape.length>0)
								shapes.push(currentShape);
							isNewShape = true;
						}
						
						
					}
					
				}
				
				
				//console.log("shapes",shapes);
				if(calcfunnr==1){
					// Formen in Zeichnung umwandeln
					let points = [];
					let currentPoint = [0, 0];
					var curvePoints,pp;
					for(i=0; i<shapes.length; i++) {
					var shape = shapes[i];
					var line = [];
					
					for(var j=0; j<shape.length; j++) {
						var point = shape[j];
						if(point.type==="curve"){
							curvePoints = flattenBezier(
								currentPoint,
								point.cp1,
								point.cp2,
								point.to,
								2);
								
							for(k=0;k<curvePoints.length;k++){
								pp=curvePoints[k];
								
								line.push({
									x: pp[0]*scfactor*scfacpx,
									y: (dbox.height-pp[1])*scfactor*scfacpx,
									px: pp[0]*scfactor*scfacpx,
									py:  (dbox.height-pp[1])*scfactor*scfacpx,
									level: ebenaktiv
								});
								
							}							
							currentPoint = point.to;						
						}
						else{
							currentPoint = [point.x,point.y];
							line.push({
								x: point.x*scfactor*scfacpx,
								y: (dbox.height-point.y)*scfactor*scfacpx,
								px: point.x*scfactor*scfacpx,
								py:  (dbox.height-point.y)*scfactor*scfacpx,
								level: ebenaktiv
							});
						}
					}
					
					if(line.length > 0) {
						zeichnung.push(line);
					}
				}
				}
				
				setLadebalken(100/2*calcfunnr);	
				
				if(calcfunnr==2){
					console.log("Linien",_this.getLineCount(),"Punkte",_this.getPointCount());
					blattwidth=werkzeuge.get("width");
					blattheight=werkzeuge.get("height");
					console.log("Blatt",blattwidth,"x",blattheight,'mm²');
					
					resizeZF();					
					updateOutElemente();
					setLadebalken(-1);
				}
				
				if(calcfunnr<2){
					calcfunnr++;
					calcytimer=setTimeout(calcpfade,1);
				}
				
			}
			
			calcpfade();
		}

		//--ini--
		var create=function(){			
			apptitel=document.title+' '+progversion;
			
			basisnode=cE(zielNode,"div","zeichenfeld");
			
			canvasHG=cE(basisnode,"canvas","canHG");
			canvasHG.style.left=rand+'px';
			canvasHG.style.top=rand+'px';
			
			canvasVorlage=cE(basisnode,"canvas","canVorlage");
			canvasVorlage.style.left=rand+'px';
			canvasVorlage.style.top=rand+'px';
			
			canvasLines=cE(basisnode,"canvas","canLines");
			canvasLines.style.left=rand+'px';
			canvasLines.style.top=rand+'px';
			
			canvasZeichnung=cE(basisnode,"canvas","canZeichnung");
			canvasZeichnung.style.left=rand+'px';
			canvasZeichnung.style.top=rand+'px';
			
			ladebalken=cE(basisnode,"div","ladebalken");
			ladebalkenf=cE(ladebalken,"div","lbfill");
			setLadebalken(-1);
			
			canvasDraw=cE(basisnode,"canvas","canDraw");
			canvasDraw.style.left=rand+'px';
			canvasDraw.style.top=rand+'px';
			
			
			canvasDraw.addEventListener('mousemove',mausmove,false);			
			canvasDraw.addEventListener('mousedown',mausdown);
			canvasDraw.addEventListener('mouseup',mausup);
			canvasDraw.addEventListener('mouseout',mausout);
			
			canvasDraw.addEventListener('touchstart',function(e){mausstat.isdown=false;mausmove(e);mausdown(e)} );
			canvasDraw.addEventListener('touchmove',mausmove);	
			canvasDraw.addEventListener('touchend',mausup);
			canvasDraw.addEventListener('touchcancel',mausup);
			
			window.addEventListener('keydown',keydown);
			window.addEventListener('keyup',keyup);
			window.addEventListener('resize',resizeZF);
			
		}
		
		create();
	}
	
	var refreshInputElemente=function(){
		var i,inp;
		for(i=0;i<inpElementeList.length;i++){
			inp=inpElementeList[i];
			if(	inp.getName()==getWort('dellaststroke')
				||
				inp.getName()==getWort('clearZeichnung')
				||
				inp.getName()==getWort('moveleft')
				||
				inp.getName()==getWort('moveright')
				||
				inp.getName()==getWort('movetop')
				||
				inp.getName()==getWort('movedown')
				||
				inp.getName()==getWort('scalemore')
				||
				inp.getName()==getWort('scaleless')
				||
				inp.getName()==getWort('exportgcode')
				||
				inp.getName()==getWort('exportsvg')
			){
				inp.inaktiv(zeichenfeld.getLineCount()==0);
			}
			if(	inp.getName()==getWort('delvorlage')){
				inp.inaktiv(!zeichenfeld.hatVorlage());
			}
			if(	inp.getName()==getWort('optimizestrokes')){
				inp.inaktiv(zeichenfeld.getLineCount()<4);
			}			
		}
	}
	
	var updateOutElemente=function(){
		var i;
		for(i=0;i<outElementeList.length;i++){
			outElementeList[i].refresh();
		}
	}
	
	var inputElement=function(captionID,typ,ziel,sEinheitID,addtolist){
		var _this=this;
		var input;
		var blockdiv;
		var vmin=undefined;
		var vmax=undefined;
		var sendetimer=undefined;
		var valsendenin=250;//ms
		var basiselement=undefined;
		var showvalueinunity=false;
		var einheitnode=undefined;
		var liste=[];
		var caption=getWort(captionID);
		var sEinheit=getWort(sEinheitID);
		
		var fchange=[];
		var lokaldata=undefined;
		if(addtolist==undefined)addtolist=true;
		
		//--api--
		this.setMinMaxStp=function(min,max,step){
			if(min!=undefined){
				input.min=min;
				vmin=parseFloat(min);
			}
			if(max!=undefined){input.max=max;vmax=parseFloat(max)};
			if(step!=undefined)input.step=step;
		}
		
		this.inaktiv=function(b){
			input.disabled =b;
		}
		
		this.getName=function(){return caption;}
		
		this.setVal=function(val){
			var i,nodes;
			if(input.type=="select"){
				nodes=input.getElementsByTagName('option');
				if(nodes.length==liste.length){
					for(i=0;i<liste.length;i++){
						if(nodes[i].value==liste[i])
							nodes.setAttribute("selected","true");
						else
							nodes.removeAttribute("selected");
					}
				}
			}				
			else
			if(input.type=="textarea"){
				input.innerHTML=val;
				input.value=val;
			}				
			else
			if(input.type=="checkbox")
				input.checked=val;
				else
				input.value=val;
			
		}
				
		this.getVal=function(){
			if(input.type=="checkbox")
				return input.checked;
				else
				return input.value;
		}
		
		this.getContainer=function(){return blockdiv;}
		
		this.setClass=function(c){
			basiselement.className=c;
			//addClass(blockdiv,c);
		}
		
		this.addEventFunc=function(func){
			fchange.push(func);
		}
		
		this.showValueInEinheit=function(b){
			showvalueinunity=b;
			if(sEinheit!=undefined){
				if(showvalueinunity){
					einheitnode.innerHTML=_this.getVal()+sEinheit;
					translatetElements.push({id:_this.getVal(),n:einheitnode,a:sEinheitID});
					}
					else{
					einheitnode.innerHTML=sEinheit;
					translatetElements.push({id:sEinheitID,n:einheitnode});
					}
			}
		}
		
		this.setdata=function(daten){lokaldata=daten;}
		this.getdata=function(){return lokaldata;}
		
		this.addListe=function(newliste){
			var i,o;
			liste=[];
			for(i=0;i<newliste.length;i++){
				o=cE(input,"option");
				o.innerHTML=getWort(newliste[i]);
				o.value=newliste[i];
				liste.push(newliste[i]);
			}
		}
		
		
		
		//--action--
		var inpchange=function(e){
			var senden=true;
		
			if(vmin!=undefined && input.value<vmin) senden=false;
			if(vmax!=undefined && input.value>vmax) senden=false;
			
			if(sendetimer!=undefined)clearTimeout(sendetimer);
			
			if(senden && fchange.length>0)
				sendetimer=setTimeout(function(){
						var i;
						for(i=0;i<fchange.length;i++){
							if(lokaldata==undefined)
									fchange[i](input.value);
								else
									fchange[i](lokaldata);
						}
							
					},valsendenin);
			
			_this.showValueInEinheit(showvalueinunity);
			
			e.preventDefault();
		}
		
		//--ini--
		var create=function(){
			var label,span,inpElementeNr=inpElementeList.length;
			var iid='input_'+typ+'_'+inpElementeNr;
			
			if(addtolist===false)iid='input_'+typ+'_cn'+ziel.childNodes.length;
			
			if(sEinheit!=undefined || typ!="button"){
				blockdiv=cE(ziel,"div");
				basiselement=blockdiv;
				}
			else{
				blockdiv=ziel;
				}
			
			
			if(typ!="button"){
				if(caption!=undefined){
					label=cE(blockdiv,"label");
					label.innerHTML=caption+':';
					translatetElements.push({id:captionID,a:":",n:label});
			
					addClass(label,"labeltext");
				}
			}			
			
			if(typ=="textarea" || typ=="select")
				input=cE(blockdiv,typ,iid);		//textbox/dropdown-liste
			else
			if(typ=="button"){
				input=cE(blockdiv,"button",iid);
				//input=cE(blockdiv,"input",iid);
				//input.type=typ;
			}
			else
			{				
				input=cE(blockdiv,"input",iid);
				input.type=typ;
			}
			
			if(typ=="button"){
				input.innerHTML=caption;
				translatetElements.push({id:captionID,n:input});
			}
			if(basiselement==undefined)basiselement=input;
							
			if(typ=="button"){
				//addClass(input,"button");
				input.addEventListener('click',inpchange);
				valsendenin=1;
			}else
			if(typ=="range" || typ=="select"){
				input.addEventListener('change',inpchange);
			}
			else
			if(typ=="number"){
				input.addEventListener('change',inpchange);
				input.addEventListener('keyup',inpchange);
			}
			else{
				input.addEventListener('change',inpchange);
				input.addEventListener('keyup',inpchange);
				input.addEventListener('mouseup',inpchange);
			}
			
			if(typ=="checkbox"){
				addClass(input,"booleanswitch");
				label=cE(blockdiv,"label");
				label.htmlFor=iid;
				valsendenin=100;
			}
			if(typ=="range"){
				valsendenin=10;
			}
						
			
			if(sEinheit!=undefined){
				einheitnode=cE(blockdiv,"span",undefined,"einheit");
				einheitnode.innerHTML=sEinheit;
				translatetElements.push({id:sEinheitID,n:einheitnode});
			}
			
			if(addtolist===true)inpElementeList.push(_this);
		}
		
		create();
	}
	
	var InfoNodeElement=function(ziel){
		var _this=this,
			infonode;
		
		//--API--
		this.refresh=function(){
			var size=zeichenfeld.getSize(),//mm
				b=""+Math.floor(size.width*10)/100,
				h=""+Math.floor(size.height*10)/100;
			
			if(spracheaktiv==="DE"){
				b=b.split('.').join(',');
				h=h.split('.').join(',');
			}
			
			infonode.innerHTML=getWort("groesse")+": "+b+" x "+h+" cm²";
		}
		
		//--ini--
		var create=function(){
			infonode=cE(ziel,"p");
			infonode.innerHTML=getWort("groesse")+": 0 x 0 cm²";
			
			outElementeList.push(_this);
		}
		
		create();
	}
	
	var Ebenenelement=function(ziel){
		var _this=this,
			basis,ul,li;
		
		this.refresh=function(){
			
		}
		
		this.addEbene=function(ebeneneu){
			ebenenset.push(ebeneneu);			
			addLiElement(ebeneneu,ebenenset.length-1);
		}
		
		var changeEbeneaktiv=function(e){
			var i,ebene;
			
			for(i=0;i<ebenenset.length;i++){
				ebene=ebenenset[i];
				ebene["aktiv"]=ebene["radiobutt"]["checked"];
				if(ebene["aktiv"])
					ebenaktiv=i;
			}
			
			zeichenfeld.setEbene();
		}
		
		var neuEbene=function(id){
			var ebeneneu={"name":"","color":farbeZeichnung};			
			ebenenset.push(ebeneneu);			
			var elemente=addLiElement(ebeneneu,ebenenset.length-1);
			//und aktivieren
			elemente.rb.checked=true;
			changeEbeneaktiv({});
		}
		
		var onChangeColor=function(e){
			this.UserData["color"]=this.value;
			zeichenfeld.setEbene();
		}
		
		var deleteEbene=function(data){
			if(ebenenset.length>1){
				var i,ebenensetneu=[];
				if(data["name"]!=undefined){
					for(i=0;i<ebenenset.length;i++){
						if(ebenenset[i]["name"]!=data["name"]){
							ebenensetneu.push(ebenenset[i]);
						}else{
							//zugehörige Linien löschen
							zeichenfeld.deleteEbene(i);
						}
					}
						
					ebenenset=ebenensetneu;
					create();
					zeichenfeld.resize();
				}
			}
			else{
				alert(getWort("nodelEbene"));
			}
		}
		
		var addLiElement=function(ebene,i){
			var li,rb,label,node,inp;
			
			li=cE(ul,"li");
			rb=cE(li,"input");
			rb.setAttribute("id","radio_"+i);
			rb.setAttribute("type","radio");
			rb.setAttribute("name","Ebenenelement");
			rb.setAttribute("value","Ebene_"+i);
			if(i==0){
				rb.setAttribute("checked",true);
				ebene["aktiv"]=true;
			}
			else{
				ebene["aktiv"]=false;
			}
			
			rb.addEventListener("change",changeEbeneaktiv);
			rb.UserData=ebene;
			
			label=cE(li,"label");// <label for="mc"> Mastercard</label> 
			label.htmlFor="radio_"+i;
			label.innerHTML=getWort('ebene')+' '+(i+1);
			ebene.name=getWort('ebene')+' '+(i+1);
			ebene["radiobutt"]=rb;
			translatetElements.push({id:"ebene",n:label,a:" "+(i+1)});
			
			//Farbauswahl
			inp=cE(li,"input",undefined,"colorpicker");
			inp.setAttribute("type","color");
			inp.setAttribute("value",ebene["color"]);
			inp.addEventListener("change",onChangeColor);
			inp.UserData=ebene;
			
			//löschen
			node=new inputElement('ebeneloeschen','button',li);
			node.addEventFunc( deleteEbene );
			node.setdata(ebene);
			
			return {rb:rb}
		}
		
		var create=function(){
			var i,ebene,node;
			//ebenenset=[{"name":"ebene 1"}];
			basis.innerHTML="";
			ebenaktiv=0;
			
			node=cE(basis,"label");
			node.innerHTML=getWort('ebeneauswahl');
			translatetElements.push({id:"ebeneauswahl",n:node});
			
			ul=cE(basis,"ul");
			for(i=0;i<ebenenset.length;i++){
				ebene=ebenenset[i];
				addLiElement(ebene,i);
			}
			
			node=new inputElement('neueEbene','button',basis);
			node.addEventFunc( neuEbene );
			
			
			outElementeList.push(_this);
		}
		
		basis=cE(ziel,"div","ebenenset","block");
		create();
	}
	
	
	
	

	var htmlloader=function(url,refunc,errorFunc){
		var loader;
		try{
			loader = new XMLHttpRequest();
		}
		catch(e) {
			try {                        
				loader  = new ActiveXObject("Microsoft.XMLHTTP");// MS Internet Explorer (ab v6)
			} 
			catch(e){
				try {                                
						loader  = new ActiveXObject("Msxml2.XMLHTTP");// MS Internet Explorer (ab v5)
				} catch(e) {
						loader  = null;
						console.log('XMLHttp nicht möglich.');
				}
			}
		}
		var startloading=function(){
			if(loader!=null){
				loader.open('GET',url,true);//open(method, url, async, user, password)
				loader.responseType='text'; //!                
				loader.setRequestHeader('Content-Type', 'text/plain'); 
				loader.setRequestHeader('Cache-Control', 'no-cache'); 
				loader.setRequestHeader('Access-Control-Allow-Headers', '*');
				loader.setRequestHeader('Access-Control-Allow-Origin', '*');
				loader.onreadystatechange = function(e){                
					if (this.readyState == 4) {
						if(loader.status!=200){}
					}
				};
				loader.onload=function(e){
					if(loader.status!=404){
						if(typeof refunc==="function")refunc(this.responseText);
					}else{
						if(typeof errorFunc==="function")errorFunc(e);
					}
				}				
				loader.onabort = loader.onerror = function(e){
					if(typeof errorFunc==="function")errorFunc(e);
				}
				// loader.timeout=  //ms
				loader.send(null);
 
			}
		}
		//--API--
		this.reload=function(){
			startloading();
		}
 
		startloading();
	}


	var loadBeispiel=function(dateiname){
		console.log(beispiellistepfad+dateiname);
		//var beispielliste=["","maus.svg","pferd.svg","tieger.svg"];
		
		inpBeispiele.setVal("");
		
		var refunc=function(data){
			if(zeichenfeld)zeichenfeld.importgcodesvg(dateiname,data);
		} 
		var errorfunc=function(e){
			console.log(":-(",e);
			alert("Fehler beim laden :-(");
		}		 
		var ohtmlloader=new htmlloader(beispiellistepfad+dateiname,refunc,errorfunc);
	}
	
	
	//--Dialoge--
	var oDialog=function(){
		var dialognode;
		var dialogtitelnode;
		var dialogtitelbutt;
		var dialogcontentnode;
		var dialogaktiv=undefined;
		var _this=this;
		
		var closeDialog=function(e){
			_this.showDialog();
			e.preventDefault();//return false
		}
		
		var create=function(){
			dialognode=cE(zielNode,"div","dialog");
			dialogtitelnode		=cE(dialognode,"h1","dialogtitel");
			dialogtitelbutt		=cE(dialognode,"div","dialogtitelbutt");
			dialogcontentnode	=cE(dialognode,"div","dialogcontent");
			
			var node=cE(dialogtitelbutt,"a",undefined,"closebutton");
			node.href="#";
			node.innerHTML="X";
			node.addEventListener('click',closeDialog);
			node.title=getWort("buttclose");
			
			_this.showDialog();
		}
		
		var settitel=function(titeltext){
			dialogtitelnode.innerHTML=getWort(titeltext);
		}
		
		this.showDialog=function(dialogtyp){
			if(dialogtyp==undefined || dialogtyp==""){
				addClass(dialognode,"unsichtbar");
				if(dialogaktiv)dialogaktiv.destroy();
				return;
			}
			
			settitel('titel_'+dialogtyp);
			
			if(dialogtyp=="einstellungen"){
				dialogaktiv=new dialogEinstellungen(dialogcontentnode);
			}
			if(dialogtyp=="importeinstellungen"){
				dialogaktiv=new dialogImport(dialogcontentnode);
			}
			delClass(dialognode,"unsichtbar");
		}
		create();
	}
	
	var dialogEinstellungen=function(zielnode){
		var vorlageninputgruppe;
		
		var input_gcodeprestart,
			input_gcodestart,
			input_gcodeLinienbegin,
			input_gcodeLinienende,
			input_gcodeende,
			inpbutt_drawspeed,
			inpbutt_movespeed,
			inpbutt_mirrowX,
			inpbutt_mirrowY,
			inpbutt_negativX,
			inpbutt_negativY,
			inpbutt_vorlagenname,
			inpbutt_durchmesser,
			zielliste;
		
		this.destroy=function(){}
		
		var changegcodeElemente=function(v){
			Programmeinstellungen.gcodeoptionsV2[v.id]=v.node.getVal();
			saveSettings();
		};
		
		var addToVorlage=function(){
			var neueVorlage={
				"name":				inpbutt_vorlagenname.getVal(),
				"erasable":true,
				"gcodeprestart":	input_gcodeprestart.getVal(),
				"gcodestart":		input_gcodestart.getVal(),
				"gcodeLinienbegin":	input_gcodeLinienbegin.getVal(),
				"gcodeLinienende":	input_gcodeLinienende.getVal(),
				"gcodeende":		input_gcodeende.getVal(),
				"movespeed":		inpbutt_drawspeed.getVal(),	//max F5000
				"drawspeed":		inpbutt_movespeed.getVal(),	//max F5000				
				"spiegelX":			inpbutt_mirrowX.getVal(),
				"spiegelY":			inpbutt_mirrowY.getVal(),
				"negativX":			inpbutt_negativX.getVal(),
				"negativY":			inpbutt_negativY.getVal(),
				"durchmesser":		inpbutt_durchmesser.getVal()
			}
			Programmeinstellungen.gcodevorlagen.push(neueVorlage);
			
			vorlagenauswahl(zielliste);
			
			inpbutt_vorlagenname.setVal("Vorlage "+Programmeinstellungen.gcodevorlagen.length);
			
			saveSettings();
		}
		
		var create=function(){
			zielnode.innerHTML="";
			var gruppe,table,tr,td,node,inpbutt;
			
			
			//Vorlagen: plotter, Laser:  name-load-del
			// 
			zielliste=cE(zielnode,"article","vorlagenwahl");
			vorlagenauswahl(zielliste);
			
			vorlageninputgruppe=cE(zielnode,"article");
			table=cE(vorlageninputgruppe,"table",undefined,"gcodinputtabelle");
			
			input_gcodeprestart=new inputElement(getWort('gcodeprestart'),'textarea',table,undefined,false);
			input_gcodeprestart.setClass('inputtextfeld');
			input_gcodeprestart.setVal(Programmeinstellungen.gcodeoptionsV2.gcodeprestart);
			input_gcodeprestart.setdata({"node":input_gcodeprestart,"id":"gcodeprestart"});
			input_gcodeprestart.addEventFunc(changegcodeElemente);
			
			input_gcodestart=new inputElement(getWort('gcodestart'),'textarea',table,undefined,false);
			input_gcodestart.setClass('inputtextfeld');
			input_gcodestart.setVal(Programmeinstellungen.gcodeoptionsV2.gcodestart);
			input_gcodestart.setdata({"node":input_gcodestart,"id":"gcodestart"});
			input_gcodestart.addEventFunc(changegcodeElemente);
			
			input_gcodeLinienbegin=new inputElement(getWort('gcodeLinienbegin'),'textarea',table,undefined,false);
			input_gcodeLinienbegin.setClass('inputtextfeld');
			input_gcodeLinienbegin.setVal(Programmeinstellungen.gcodeoptionsV2.gcodeLinienbegin);
			input_gcodeLinienbegin.setdata({"node":input_gcodeLinienbegin,"id":"gcodeLinienbegin"});
			input_gcodeLinienbegin.addEventFunc(changegcodeElemente);
			
			input_gcodeLinienende=new inputElement(getWort('gcodeLinienende'),'textarea',table,undefined,false);
			input_gcodeLinienende.setClass('inputtextfeld');
			input_gcodeLinienende.setVal(Programmeinstellungen.gcodeoptionsV2.gcodeLinienende);
			input_gcodeLinienende.setdata({"node":input_gcodeLinienende,"id":"gcodeLinienende"});
			input_gcodeLinienende.addEventFunc(changegcodeElemente);
			
			input_gcodeende=new inputElement(getWort('gcodeende'),'textarea',table,undefined,false);
			input_gcodeende.setClass('inputtextfeld');
			input_gcodeende.setVal(Programmeinstellungen.gcodeoptionsV2.gcodeende);
			input_gcodeende.setdata({"node":input_gcodeende,"id":"gcodeende"});
			input_gcodeende.addEventFunc(changegcodeElemente);
			
			vorlageninputgruppe=cE(zielnode,"article",undefined,"input2");
			inpbutt_movespeed=new inputElement(getWort('movespeed'),'number',vorlageninputgruppe,'mm/min',false);
			inpbutt_movespeed.setVal(Programmeinstellungen.gcodeoptionsV2.movespeed);
			inpbutt_movespeed.setMinMaxStp(500,5000);//,step
			inpbutt_movespeed.setdata({"node":inpbutt_movespeed,"id":"movespeed"});
			inpbutt_movespeed.addEventFunc(changegcodeElemente);
		
			inpbutt_drawspeed=new inputElement(getWort('drawspeed'),'number',vorlageninputgruppe,'mm/min',false);
			inpbutt_drawspeed.setVal(Programmeinstellungen.gcodeoptionsV2.drawspeed);
			inpbutt_drawspeed.setMinMaxStp(500,5000);
			inpbutt_drawspeed.setdata({"node":inpbutt_drawspeed,"id":"drawspeed"});
			inpbutt_drawspeed.addEventFunc(changegcodeElemente);
			
			//inpbutt_durchmesser
			inpbutt_durchmesser=new inputElement(getWort('durchmesser'),'number',vorlageninputgruppe,'mm',false);
			inpbutt_durchmesser.setVal(Programmeinstellungen.gcodeoptionsV2.durchmesser);
			inpbutt_durchmesser.setMinMaxStp(0.01,6);
			inpbutt_durchmesser.setdata({"node":inpbutt_durchmesser,"id":"durchmesser"});
			inpbutt_durchmesser.addEventFunc(changegcodeElemente);
			
					
			inpbutt_mirrowX=new inputElement(getWort('spiegelX'),'checkbox',vorlageninputgruppe,'',false);
			inpbutt_mirrowX.setVal(Programmeinstellungen.gcodeoptionsV2.spiegelX);
			inpbutt_mirrowX.setdata({"node":inpbutt_mirrowX,"id":"spiegelX"});
			inpbutt_mirrowX.addEventFunc(changegcodeElemente);
			
			inpbutt_mirrowY=new inputElement(getWort('spiegelY'),'checkbox',vorlageninputgruppe,'',false);
			inpbutt_mirrowY.setVal(Programmeinstellungen.gcodeoptionsV2.spiegelY);
			inpbutt_mirrowY.setdata({"node":inpbutt_mirrowY,"id":"spiegelY"});
			inpbutt_mirrowY.addEventFunc(changegcodeElemente);
			
			
			
			inpbutt_negativX=new inputElement(getWort('negativX')+' (<b>'+getWort("wertenegativ")+'</b>)','checkbox',vorlageninputgruppe,'',false);
			inpbutt_negativX.setVal(Programmeinstellungen.gcodeoptionsV2.negativX);
			inpbutt_negativX.setdata({"node":inpbutt_negativX,"id":"negativX"});
			inpbutt_negativX.addEventFunc(changegcodeElemente);
			
			inpbutt_negativY=new inputElement(getWort('negativY')+' (<b>'+getWort("wertenegativ")+'</b>)','checkbox',vorlageninputgruppe,'',false);
			inpbutt_negativY.setVal(Programmeinstellungen.gcodeoptionsV2.negativY);
			inpbutt_negativY.setdata({"node":inpbutt_negativY,"id":"negativY"});
			inpbutt_negativY.addEventFunc(changegcodeElemente);
						
			
			inpbutt_vorlagenname=new inputElement(getWort('vorlagenname'),'text',vorlageninputgruppe,undefined,false);
			inpbutt_vorlagenname.setVal("Vorlage "+Programmeinstellungen.gcodevorlagen.length);
			inpbutt_vorlagenname.addEventFunc(function(v){});
			
			
			
			
			inpbutt=new inputElement(getWort('addtovorlage'),'button',inpbutt_vorlagenname.getContainer(),undefined,false);
			inpbutt.addEventFunc(function(v){addToVorlage()});
			
			
			gruppe=cE(zielnode,"article");
			node=cE(gruppe,"p");
			node.innerHTML=getWort("gcodeplatzhaltertext");
			
			//TODO:
			//als Vorlage speichern
			//-> Programmeinstellungen.gcodeoptionsV2 ...
		}
		
		var setdatenvonvorlage=function(data){
			console.log(data);		
			input_gcodeprestart.setVal(data.daten.gcodeprestart);
			input_gcodestart.setVal(data.daten.gcodestart);
			input_gcodeLinienbegin.setVal(data.daten.gcodeLinienbegin);
			input_gcodeLinienende.setVal(data.daten.gcodeLinienende);
			input_gcodeende.setVal(data.daten.gcodeende);
			inpbutt_drawspeed.setVal(data.daten.drawspeed);
			inpbutt_movespeed.setVal(data.daten.movespeed);			
			inpbutt_mirrowX.setVal(data.daten.spiegelX);
			inpbutt_mirrowY.setVal(data.daten.spiegelY);
			inpbutt_negativX.setVal(data.daten.negativX);
			inpbutt_negativY.setVal(data.daten.negativY);
			inpbutt_durchmesser.setVal(data.daten.durchmesser);
			
			Programmeinstellungen.gcodeoptionsV2.gcodeprestart=data.daten.gcodeprestart;
			Programmeinstellungen.gcodeoptionsV2.gcodestart=data.daten.gcodestart;
			Programmeinstellungen.gcodeoptionsV2.gcodeLinienbegin=data.daten.gcodeLinienbegin;
			Programmeinstellungen.gcodeoptionsV2.gcodeLinienende=data.daten.gcodeLinienende;
			Programmeinstellungen.gcodeoptionsV2.drawspeed=data.daten.drawspeed;
			Programmeinstellungen.gcodeoptionsV2.movespeed=data.daten.movespeed;
			Programmeinstellungen.gcodeoptionsV2.durchmesser=data.daten.durchmesser;
			Programmeinstellungen.gcodeoptionsV2.spiegelX=data.daten.spiegelX;
			Programmeinstellungen.gcodeoptionsV2.spiegelY=data.daten.spiegelY;
			Programmeinstellungen.gcodeoptionsV2.negativX=data.daten.negativX;
			Programmeinstellungen.gcodeoptionsV2.negativY=data.daten.negativY;
			saveSettings();
			
		}
		
		var delvorlage=function(data){
			var i,nr=data.nr;
			var newliste=[];
			for(i=0;i<Programmeinstellungen.gcodevorlagen.length;i++){
				if(i!=nr)newliste.push(Programmeinstellungen.gcodevorlagen[i]);
			}
			Programmeinstellungen.gcodevorlagen=newliste;
			saveSettingsNow();
			create();
		}
		
		var vorlagenauswahl=function(ziel){
			var i,datavorlage,node,ul,li,inpbutt;
			//nodeinput=new inputElement('','liste',ziel,'');
			ziel.innerHTML="";
			ul=cE(ziel,"ul");
			for(i=0;i<Programmeinstellungen.gcodevorlagen.length;i++){
				datavorlage=Programmeinstellungen.gcodevorlagen[i];
				li=cE(ul,'li');
				node=cE(li,'span');
				node.innerHTML=datavorlage.name;
				
				inpbutt=new inputElement(getWort('loadvorlage'),'button',li,undefined,false);
				inpbutt.setdata({nr:i,daten:datavorlage});
				inpbutt.addEventFunc( function(v){setdatenvonvorlage(v);});
			
				if(!(datavorlage.erasable===false)){
					inpbutt=new inputElement(getWort('deletevorlage'),'button',li,undefined,false);
					inpbutt.setdata({nr:i,daten:datavorlage});
					inpbutt.addEventFunc( function(v){delvorlage(v);});
				}
			}
		}
		
		create();
	}

	var dialogImport=function(zielnode){
		var input_genauigkeit;
		
		var changegenauigkeit=function(v){
			var val=parseFloat(v.node.getVal());
			Programmeinstellungen.importoptionen[v.id]=val;
			
			val=(100-val)/100;											//100%..0%
			Programmeinstellungen.drawoptions.abweichung=2+4*val;		//  2...6
			Programmeinstellungen.drawoptions.abstandmin=0.2+0.6*val;	//0.2...0.8
			Programmeinstellungen.drawoptions.grobabweichung=20+60*val; // 20...80
			saveSettings();
		}
		
		this.destroy=function(){}
		
		var create=function(){
			zielnode.innerHTML="";
			var gruppe,table,tr,td,node,inpbutt;
			
			gruppe=cE(zielnode,"article",undefined,"importoption");
			
			input_genauigkeit=new inputElement(getWort('genauiggkeit'),'range',gruppe,"%",false);
			input_genauigkeit.setMinMaxStp(0,100,1);
			input_genauigkeit.setdata({"node":input_genauigkeit,"id":"genauigkeit"});
			input_genauigkeit.setVal(Programmeinstellungen.importoptionen.genauigkeit);
			input_genauigkeit.showValueInEinheit(true);
			input_genauigkeit.addEventFunc(changegenauigkeit);
			//input_genauigkeit.addEventFunc(changeElementeValue);
			
			gruppe=cE(zielnode,"article");
			node=cE(gruppe,"p");
			node.innerHTML=getWort("text_importeinstellungen");
			
		}
		
		
		create();
	}
	
	
	console.log('%c '+progversion+' ','color:#fff;background-color:#42963f;');
}

//Start nach dem Laden
window.addEventListener('load', function (event) {
		var osplinewriter;
		osplinewriter=new splinewriter();
		osplinewriter.ini("myapplication");
	});