console.log('Initialisation');
require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
var wd=require("word-definition");
var fs=require('fs');
var vars=require('./vars.json');
var pendingRenames={};
let defaultPrefix="/";
const LGRoles=require('./personnages.json');
var LGexistingRoles=[];
for (var k in LGRoles){
    LGexistingRoles.push(k);
}
var LGqueue={};
var LGgame={};

client.login(process.env.DISORD_TOKEN);

client.on("ready",()=>{
    console.log(client.user.tag+' Prêt');
    client.user.setActivity("/pseudo", { type: "LISTENING"});
});

client.on('error', console.error);

client.on("message", async msg => {
    //Gestion des valeurs par default
    if(msg.author.bot) return;
    if(!msg.guild) return console.log(`MP: ${msg.content}`);
    if (vars[msg.guild.id]===undefined) vars[msg.guild.id]={};
    if (vars[msg.guild.id]['prefix']===undefined) vars[msg.guild.id]['prefix']=defaultPrefix;
    
    if(msg.content.indexOf(vars[msg.guild.id]['prefix']) !== 0) return;  
    const args = msg.content.slice(vars[msg.guild.id]['prefix'].length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command=='ping'){
        LogCommand(msg);
        msg.channel.send(`Pong ! ${Math.round(client.ws.ping)}ms`);
    }

    if (command=='save'){
        fs.writeFile("./vars.json",JSON.stringify(vars,null,4), (err)=>{
            if(err) return console.error(err);
        });
        LogCommand(msg);
        msg.channel.send('Config sauvegardée');
    }

    if (command=='dico'){
        LogCommand(msg);
        wd.getDef(args[0], "fr", {exact:false}, function(definition) {
            if (!definition.category) return msg.reply(`Je n'ai pas trouvé la définition de ${definition.word} sur https://fr.wiktionary.org/`);
            return  msg.channel.send(`\`\`\`${definition.word} : ${definition.category}\r${definition.definition}\`\`\``);           
        });        
    }

    if (command=='lg'){
        LogCommand(msg);
        if (vars[msg.guild.id]===undefined) vars[msg.guild.id]={};
        if (vars[msg.guild.id]['LG']===undefined) vars[msg.guild.id]['LG']={};
        if (vars[msg.guild.id]['LG']['selectedRoles']===undefined) vars[msg.guild.id]['LG']['selectedRoles']=["Villageois","Loup-garou","Villageois","Loup-garou","Villageois","Loup-garou"];
        if (LGqueue[msg.guild.id]===undefined) LGqueue[msg.guild.id]=[];

        if (args[0]=='install'){
            if (!msg.member.hasPermission('ADMINISTRATOR')) return msg.reply('Cette commande est reservée aux administrateurs');                
            vars[msg.guild.id]['LG']={};
            vars[msg.guild.id]['LG']['playerRoles']=[];
            vars[msg.guild.id]['LG']['playerChannels']=[];

            msg.channel.send("Création des Roles et channels en cours...");
            console.log("Role creation...");
            console.log(msg.guild.roles);
            console.log(msg.guild.me.hasPermission("MANAGE_ROLES"));

            try{
                msg.guild.roles.create({
                    data: {
                        name: 'Players',
                        color: 'BLUE',
                    },
                    reason: 'Group containing all players',
                }).then(playersRole=>{
                    console.log(`Role created: ${playersRole}`);
                    
                    console.log("Rôle Joueurs créé !");
                    vars[msg.guild.id]['LG']['playersRole']=playersRole;
                    console.log("Démarrage de la création de la catégorie...");
                    msg.guild.channels.create(//Creation de la catégorie
                        'Loups-Garous',
                        {
                            type:'category',
                            permissionOverwrites: [{id: msg.guild.roles.everyone, deny: ['VIEW_CHANNEL']},{id: msg.guild.me.roles.highest, allow: ['VIEW_CHANNEL']},{id: playersRole, allow: ['VIEW_CHANNEL']}]
                        }
                    ).then(
                        LGCat=>
                        {
                            console.log("Catégorie créee !");
                            vars[msg.guild.id]['LG']['LGCat']= LGCat;
                            console.log("Démarrage de la création du channel logs...");
                            msg.guild.channels.create(//Creation des channel text et vocal du village
                                'logs-LG', 
                                {
                                    type: 'text',
                                    parent : LGCat,
                                    permissionOverwrites: [{id: msg.guild.roles.everyone, deny: ['VIEW_CHANNEL']},{id: msg.guild.me.roles.highest, allow: ['VIEW_CHANNEL']}]
                                }
                            ).then(logsChan=>{
                                vars[msg.guild.id]['LG']['logsChannel']=logsChan.id;
                                console.log("Channel logs créé !");
                            });
                            console.log("Démarrage de la création du Channel Village textuel...");
                            msg.guild.channels.create(//Creation des channel text et vocal du village
                                'village', 
                                {
                                    type: 'text',
                                    parent : LGCat,
                                    permissionOverwrites: [{id: msg.guild.roles.everyone, deny: ['VIEW_CHANNEL']},{id: msg.guild.me.roles.highest, allow: ['VIEW_CHANNEL']},{id: playersRole, allow: ['VIEW_CHANNEL']}]
                                }
                            ).then(villageTextChan=>{
                                vars[msg.guild.id]['LG']['villageTextChan']=villageTextChan;
                                console.log("Channel Village textuel créé !");
                            });           
                            console.log("Démarrage de la création du Channel Village Vocal...");                         
                            msg.guild.channels.create(
                                'Village', 
                                {
                                    type: 'voice',
                                    parent : LGCat,
                                    permissionOverwrites: [{id: msg.guild.roles.everyone, deny: ['VIEW_CHANNEL']},{id: msg.guild.me.roles.highest, allow: ['VIEW_CHANNEL']},{id: playersRole, allow: ['VIEW_CHANNEL']}]
                                }
                            ).then(villageVoiceChan=>{
                                vars[msg.guild.id]['LG']['villageVoiceChan']=villageVoiceChan;
                                console.log("Channel Village Vocal créé !");
                            });                        
                        
                            for (let i =0; i<=17; i++){ //Création des channels individuels
                                console.log(`Démarrage de la création du Role Joueur ${i+1} ...`);
                                msg.guild.roles.create(
                                    {
                                        data : {
                                            name: `Joueur${i+1}`,
                                            color: 'BLUE'
                                        },
                                        reason: 'Joueur individuel de Loup-Garou',
                                    }
                                ).then(
                                    newRole=>{
                                        console.log(`Role Joueur${i+1} créé !`);
                                        console.log(`Démarrage de la création du Channel Joueur${i+1} ...`);
                                        msg.guild.channels.create(`Joueur${i+1}`, 
                                            {
                                                type: 'text',
                                                parent : LGCat,
                                                permissionOverwrites: [
                                                    {id: msg.guild.roles.everyone, deny: ['VIEW_CHANNEL']},
                                                    {id: newRole, allow: ['VIEW_CHANNEL']},
                                                    {id: msg.guild.me.roles.highest, allow: ['VIEW_CHANNEL']}
                                                ]
                                            }
                                        ).then(newChan => {
                                            console.log(`Channel Joueur${i+1} créé !`);
                                            vars[msg.guild.id]['LG']['playerRoles'][i]=newRole.id;  
                                            vars[msg.guild.id]['LG']['playerChannels'][i]=newChan.id;                                                                            
                                        });
                                    }
                                );      
                            }
                            console.log("Fin de la création des joueurs !");
                            setTimeout(function(){
                                console.log(`Demarrage du finally : ${vars[msg.guild.id]['LG']['LGCat']}`);
                                vars[msg.guild.id]['LG']['LGCat']=vars[msg.guild.id]['LG']['LGCat'].id;
                                vars[msg.guild.id]['LG']['villageTextChan']=vars[msg.guild.id]['LG']['villageTextChan'].id;
                                vars[msg.guild.id]['LG']['villageVoiceChan']=vars[msg.guild.id]['LG']['villageVoiceChan'].id;
                                vars[msg.guild.id]['LG']['playersRole']=vars[msg.guild.id]['LG']['playersRole'].id;
                                setTimeout(function(){
                                    fs.writeFile("./vars.json",JSON.stringify(vars,null,4), (err)=>{
                                        if(err) return console.error(err);
                                    });
                                    msg.channel.send("Configuration terminée !");
                                    client.channels.cache.get(vars[msg.guild.id]['LG']['logsChannel']).send("Loup garou installé sur le serveur ! Pour donner les droits d'animateurs du loup garou, donnez à la personne concernée la visibilité sur ce channel de logs");
                                },500);
                            }, 20000);
                        }
                    );                
                }).catch(err=> console.error(err));
            }
            catch(err){console.error(err);}
        }
        else if (args[0]=='uninstall'){
            if (!msg.member.hasPermission('ADMINISTRATOR')) return msg.reply('Cette commande est reservée aux administrateurs');
            msg.channel.send("Suppression des channels et roles en cours...");
            vars[msg.guild.id]['LG']['playerRoles'].forEach(role =>{if (role!=null) msg.guild.roles.fetch(role).then(toDelete => toDelete.delete());});                
            vars[msg.guild.id]['LG']['playerChannels'].forEach(chan =>{if (chan!=null) client.channels.cache.get(chan).delete();});
            msg.guild.roles.fetch(vars[msg.guild.id]['LG']['playersRole']).then(toDelete => toDelete.delete());
            client.channels.cache.get(vars[msg.guild.id]['LG']['villageTextChan']).delete();
            client.channels.cache.get(vars[msg.guild.id]['LG']['villageVoiceChan']).delete();            
            client.channels.cache.get(vars[msg.guild.id]['LG']['logsChannel']).delete();
            client.channels.cache.get(vars[msg.guild.id]['LG']['LGCat']).delete();
            delete vars[msg.guild.id]['LG'];
            fs.writeFile("./vars.json",JSON.stringify(vars,null,4), (err)=>{
                if(err) return console.error(err);
            });
            msg.channel.send("Désinstallation du Loup-Garou effectuée ! Si des channels du loup-garou apparaissent encore, essayez de fermer et réouvrir discord pour vérifier que ce n'est pas un problème de cache. Si des channels persistent encore après redémarrage, vous pouvez les supprimer manuellement");
        }
        else if(args[0]=='join'){
            if(LGqueue[msg.guild.id].length>=18){return msg.reply("File d'attente complète.");}
            if (LGqueue[msg.guild.id].includes(msg.member)) return msg.reply(" est déjà dans la file d'attente.");
            LGqueue[msg.guild.id].push(msg.member);
            msg.reply(`ajouté à la file d'attente des joueurs de loup-garou (${LGqueue[msg.guild.id].length} dans la file)`);                       
        }
        else if(args[0]=='leave'){
            if (!LGqueue[msg.guild.id].includes(msg.member)) return msg.reply(" n'était pas dans la file d'attente.")
            LGqueue[msg.guild.id].splice(LGqueue[msg.guild.id].indexOf(msg.member),1);
            return msg.reply(" a quitté la file d'attente.");
        }else if(args[0]=='kick'){
            console.log(`${vars[msg.guild.id]['prefix']}kick ${args[1]} de ${LGqueue[msg.guild.id].join(", ")}`);
            if(!msg.member.permissionsIn(client.channels.cache.get(vars[msg.guild.id]['LG']['logsChannel'])).has("VIEW_CHANNEL")) return msg.reply("Commande reservée aux animateurs");
            //TODO créer la gestion du kick
            return msg.reply(` La commande de kick n'est pas encore prête, vous pouvez utiliser "${vars[msg.guild.id]['prefix']}lg queue clear" comme solution de remplacement en attendant.`);
        }
        else if(args[0]=='queue'){
            if (args[1]=='clear'&& msg.member.permissionsIn(client.channels.cache.get(vars[msg.guild.id]['LG']['logsChannel'])).has("VIEW_CHANNEL")){LGqueue[msg.guild.id]=[];}
            return msg.channel.send(`${LGqueue[msg.guild.id].length} Joueurs dans la file d'attente : ${LGqueue[msg.guild.id]}`);
        }else if(args[0]=='reset'){
            LGreset(msg.guild);
        }
        else if(args[0]=='start'){
            if (LGqueue[msg.guild.id].length<3) return msg.reply(` le nombre de joueurs est insufisant pour démarrer la partie. (${LGqueue[msg.guild.id].length}/3)`);
            if (vars[msg.guild.id]['LG']['selectedRoles'].length!=LGqueue[msg.guild.id].length+3) return msg.reply(` 3 personnages de plus que le nombre de joueurs doivent être selectionnés pour démarrer la partie (${vars[msg.guild.id]['LG']['selectedRoles'].length}/${LGqueue[msg.guild.id].length+3})`);
            return LGstart(msg.guild);
        }else if(args[0]=='roles'){
            if(args[1]=='add'){
                if (!LGexistingRoles.includes(args[2])) return msg.reply(" personnage inexistant.");
                if (vars[msg.guild.id]['LG']['selectedRoles'].length==21) return msg.reply("Il y a déjà assez de personnages pour le nombre maximal de joueurs.");
                vars[msg.guild.id]['LG']['selectedRoles'].push(args[2]);
                return msg.reply(`${args[2]} ajouté à la liste des personnages.`);                
            }else if(args[1]=='set'){
                if (args.length<=2) return msg.send("liste de personnages invalide.");
                vars[msg.guild.id]['LG']['selectedRoles']=[];
                for (i=2;i<args.length;i++){
                    if (LGexistingRoles.includes(args[i])) vars[msg.guild.id]['LG']['selectedRoles'].push(args[i]);
                }                
                return msg.reply(` Liste de personnages selectionnés :\n- ${vars[msg.guild.id]['LG']['selectedRoles'].join("\n- ")}`);
            }else if(args[1]=='remove'){
                if (!vars[msg.guild.id]['LG']['selectedRoles'].includes(args[2])) return msg.reply(" personnage absent.");
                vars[msg.guild.id]['LG']['selectedRoles'].splice(vars[msg.guild.id]['LG']['selectedRoles'].indexOf(args[2]),1);
                return msg.reply(` Personnages restants :\n- ${vars[msg.guild.id]['LG']['selectedRoles'].join("\n- ")}`);
            }else if(args[1]=='list'){
                return msg.reply(` Personnages existants :\n- ${LGexistingRoles.join("\n- ")}\nPersonnages sélectionnés :\n- ${vars[msg.guild.id]['LG']['selectedRoles'].join("\n- ")}`);
            }else if(args[1]=='define'){
                if (!LGexistingRoles.includes(args[2])) return msg.reply("Ce personnage n'existe pas.");                
                return msg.reply(LGdefine(args[2]))
            }
        }
    }

    if (command=='config'){
        LogCommand(msg);
        if (!msg.member.hasPermission('ADMINISTRATOR')) return msg.reply('Cette commande est reservée aux administrateurs');        
        if (args[0]=='prefix'){
            vars[msg.guild.id]['prefix']=args[1];
            fs.writeFile("./vars.json",JSON.stringify(vars,null,4), (err)=>{
                if(err) return console.error(err);
            });
            return msg.channel.send(`Le préfixe a été reglé à : ${args[1]}`);
        }
        if (args[0]=="renameChannel"){            
            vars[msg.guild.id]['renameChannel']=args[1];
            fs.writeFile("./vars.json",JSON.stringify(vars,null,4), (err)=>{
                if(err) return console.error(err);
            });          
            return msg.channel.send(`Channel de reception des demandes de rename réglé à ${args[1]}`);        
        }
        if (args[0]=="list"){
            return msg.reply(JSON.stringify(vars[msg.guild.id]));
        }
        msg.reply(`
Pour consulter les réglages du bot sur le serveur : ${vars[msg.guild.id]['prefix']}config list 
Pour changer le prefix du bot : ${vars[msg.guild.id]['prefix']}config prefix NouveauPrefix
Pour changer le channel de reception des demandes de rename : ${vars[msg.guild.id]['prefix']}config renameChannel #channel`);//Aide si la commande config a été tapée sans arguments valides
    }

    if (command=='roll' || command=='r'){
        LogCommand(msg);
        let des=args[0].split('d');   
        if (isNaN(des[0]) || isNaN(des[1])) return msg.reply("Format incorrect ");     
        let reponse = `lance ${des[0]} dés à ${des[1]} faces : `;
        let total=0;        
        if(des[0]<=0 || des[1]<=0){
            reponse="Je... Mais... Non !!!";
        }        
        else if (des[0]==1){
            reponse+=Math.ceil(Math.random()*des[1]);
        }
        else if(des[0]>10000){
            reponse="Ho, j'suis pas un robot !\rAttendez...\r*Rebooting sequence*";
        }
        else{            
            let rolls=Array();
            for (var i =0; i<des[0]; i++){
                let roll = Math.ceil(Math.random()*des[1]);
                total+=roll;
                rolls.push(`[${roll}]`);
            }
            reponse+=`${rolls.join('+')}=${total}`;
        }        
        if (reponse.length>1951){
            reponse=total;
            if (reponse.length>1951){reponse="Beaucoup trop !";}            
            msg.reply(reponse);
            return;
        }
        msg.reply(reponse);
        msg.delete;
    }

    if (command =='rename' || command == 'pseudo'){
        if (pendingRenames[msg.guild.id]===undefined) pendingRenames[msg.guild.id]={};
        console.log(`${msg.guild.name}, #${msg.channel.name}, @${msg.member.displayName} : ${msg.content}`); 
        if (vars[msg.guild.id]['renameChannel']===undefined) return msg.reply("Impossible : le canal de reception n'a pas été configuré");
        let newName = args.join(' ');                
        let regex= /<#(.+)>/;
        let chanId =vars[msg.guild.id]['renameChannel'].replace(regex,'$1');
        let qui = msg.member;
        if (!qui.manageable){
            msg.reply("Impossible : Vous avez un rôle supérieur ou égal au mien");
            return;
        }
        if (newName.length>32){
            msg.reply("Impossible : Votre pseudo ne peut exceder 32 caractères");
            return;
        }
        if (newName.length==0){
            msg.reply("Erreur : Veuillez saisir un pseudo");
            return;
        }
        msg.reply("Votre demande de changement de pseudo a été envoyée à l'équipe de modération");  
        client.channels.cache.get(chanId).send(`${msg.author} veut être renommé en ${newName}`)
        .then(message=>{
            message.react('👍').then(() => message.react('👎')).catch((error) => {
                console.error(error);
            });;
            pendingRenames[msg.guild.id][message.id]={};
            pendingRenames[msg.guild.id][message.id]['memberId']=msg.member.id;
            pendingRenames[msg.guild.id][message.id]['newName']=newName;
        });    
    }
});

client.on('messageReactionAdd', async(reaction, user) => {
    if (user.bot) return;      
    if (reaction.partial){
        try{
            await reaction.fetch();
        }catch(err){
            console.log(`Erreur de recuperation du message :${err}`);
            return;
        }
    } 
    if (pendingRenames[reaction.message.guild.id]===undefined) {
        pendingRenames[reaction.message.guild.id]={};
    }     
    if (pr=pendingRenames[reaction.message.guild.id][reaction.message.id]){  
        let qui= (await reaction.message.guild.member(pr.memberId));         
        if (reaction.emoji.name === '👍'){                
            console.log(`Changement de pseudo de @${qui.displayName} en @${pr.newName} accepté par @${user.username}`);                 
            reaction.message.channel.send(`:white_check_mark: @${qui.displayName}:arrow_forward:@${pr.newName} : Changement de pseudo de ${qui.user} **accepté** par ${user}`);
            qui.setNickname(pr.newName);
            reaction.message.delete();
        }
        else if (reaction.emoji.name === '👎'){
            console.log(`Changement de pseudo de @${qui.displayName} en @${pr.newName} refusé par @${user.username}`);
            reaction.message.channel.send(`:x: Changement de pseudo de ${qui.user} en ${pr.newName} **refusé** par ${user}`);            
            qui.send(`Votre demande de changement de pseudo en @${pr.newName} a été refusée par la modération`).catch((error) => {
                if (error.message=="Cannot send messages to this user") reaction.message.channel.send(`Les messages privés de ${qui} ne sont pas ouverts, je n'ai pas pu le prévenir du refus de son pseudo.`);
                else console.error(error.message);
            });
            reaction.message.delete();
        }
        delete pendingRenames[reaction.message.guild.id][reaction.message.id];
    }
    if(LGgame[reaction.message.guild.id]!=undefined){
        if (LGgame[reaction.message.guild.id]['step']!=undefined){
            if(LGgame[reaction.message.guild.id]['step']=="voyante"){
                if (LGgame[reaction.message.guild.id]['voyante']!=undefined){
                    if (LGgame[reaction.message.guild.id]['voyante'][user.id]!=undefined){
                        if(LGgame[reaction.message.guild.id]['voyante'][user.id][reaction.emoji.name]!=undefined){
                            let cible=LGgame[reaction.message.guild.id]['voyante'][user.id][reaction.emoji.name];
                            reaction.message.channel.send(`${cible} est : ${LGgame[reaction.message.guild.id]['players'][cible].actualRole}`);
                            reaction.message.delete();
                            delete LGgame[reaction.message.guild.id]['voyante'][user.id];
                        }
                    }
                }
            }            
        }
    }
});

function LogCommand(msg){
    console.log(`${msg.guild.name}, #${msg.channel.name}, @${msg.member.displayName} : ${msg.content}`); 
}

function LGdefine(character){
    return `${character} :
Equipe : ${LGRoles[character]['camp']}
Ordre du tour : ${LGRoles[character]['tour']}
Pouvoir : ${LGRoles[character]['pouvoir']}`;
}

function LGstart(guild){
    LGreset(guild);    
    let playersRole=guild.roles.cache.get(vars[guild.id]['LG']['playersRole']);
    let i=0;
    LGgame[guild.id]['roleList']=[];
    for(var r in vars[guild.id]['LG']['selectedRoles']){
        LGgame[guild.id]['roleList'].push(vars[guild.id]['LG']['selectedRoles'][r]);
    }
    LGgame[guild.id]['step']="start";
    LGqueue[guild.id].forEach(player=>{        
        player.roles.add([playersRole,guild.roles.cache.get(vars[guild.id]['LG']['playerRoles'][i])]);
        let perso = vars[guild.id]['LG']['selectedRoles'].splice(Math.floor(Math.random()*vars[guild.id]['LG']['selectedRoles'].length),1)[0];
        LGgame[guild.id]['players'][player.id]={
            name: player.displayName,
            startingRole: perso,
            actualRole: perso,
            playerRole: guild.roles.cache.get(vars[guild.id]['LG']['playerRoles'][i]),
            playerChan: client.channels.cache.get(vars[guild.id]['LG']['playerChannels'][i])
        }
        client.channels.cache.get(vars[guild.id]['LG']['playerChannels'][i]).send(`Bonjour ${player},\nVous êtes ${LGdefine(perso)}`);
        i++;
    });
    LGgame[guild.id]['playerList']=[];
    for( var p in LGgame[guild.id]['players']){
        LGgame[guild.id]['playerList'].push(p);
    }
    LGgame[guild.id]['pool']=vars[guild.id]['LG']['selectedRoles'];
    vars[guild.id]['LG']['selectedRoles']=LGgame[guild.id]['roleList'];
    console.log(LGgame[guild.id]);
    client.channels.cache.get(vars[guild.id]['LG']['logsChannel']).send(`${LGgame[guild.id]['playerList'].join(" ")} lancent une partie avec comme personnages :\n- ${LGgame[guild.id]['roleList'].join("\n- ")}`); 
    client.channels.cache.get(vars[guild.id]['LG']['villageTextChan']).send(`Bienvenue au village,
${LGgame[guild.id]['playerList'].join(">, <@")}
Parmis vous se tiennent potentiellement :
${LGgame[guild.id]['roleList'].join(", ")}
Mais 3 de ces personnages sont en exil.
Demain, vous vous rassemblerez en conseil pour executer l'un d'entre vous. Si c'est un Loup, le village sera sauvé, sinon, il sera condamné.
Pour l'heure, la nuit va bientot tomber !`);
    setTimeout(function(){
        LGtourLoupGarou(guild);
    }, 30000);    
}

function LGtourLoupGarou(guild){
    LGgame[guild.id]['step']="loups";
    client.channels.cache.get(vars[guild.id]['LG']['villageTextChan']).send("Les loups arpentent les rues et prennent connaissance de leurs identités mutuelles,\nSi le loup est seul, il peut découvrir l'identité de l'un des exilés.");
    if(LGgame[guild.id]['roleList'].includes("Loup-garou") || LGgame[guild.id]['roleList'].includes("Loup-rêveur")){
        let garousIds=[];
        let reveursIds=[];
        for(var p in LGgame[guild.id]['players']){
            let player = LGgame[guild.id]['players'][p];
            if(player.startingRole=="Loup-garou") garousIds.push(p);
            if(player.startingRole=="Loup-rêveur") reveursIds.push(p);
        }
        if(garousIds.length>0 && garousIds.length+reveursIds.length>1){
            garousIds.forEach(garou=>{
                let otherGarous=[];
                let mess="Vous arpentez les rues à la recherche de vos semblables,";
                garousIds.forEach(g=>{
                    if(g!=garou){
                        otherGarous.push(g);
                    }
                });
                if(otherGarous.length>0){             
                    mess+=`\nVous rencontrez ${otherGarous.join(", ")} !`;
                }
                if(reveursIds.length>0){   
                    mess+=`\nVous tombez sur ${reveursIds.join(", ")} dormant à poings fermés.`;
                }
                LGgame[guild.id]['players'][garou].playerChan.send(mess);
            });               
        }
        else if(garousIds.length==1){
            LGgame[guild.id]['players'][garousIds[0]].playerChan.send("Vous arpentez les rues à la recherche de vos semblables, mais vous êtes désespérement seul.\nDu haut de la colline, vous pouvez découvrir l'identité de l'un de 3 exilés.");
            LGgame[guild.id]['players'][garousIds[0]].playerChan.send("*Version beta, ce pouvoir n'est pas encore disponible.*");//TODO Ajouter le systeme de découverte des exilés.
        }
        if(reveursIds.length>0){
            reveursIds.forEach(reveur=>{
                LGgame[guild.id]['players'][reveur].playerChan.send("Les autres loups, s'il y en a, prennent connaissance de votre identité.");
            });
        }
        setTimeout(function(){
            LGtourVoyante(guild);
        }, 30000);
        return; 
    }
    LGtourVoyante(guild);
}

function LGtourVoyante(guild){
    LGgame[guild.id]['step']="voyante";
    if(!LGgame[guild.id]['roleList'].includes("Voyante")) return LGtourVoleur(guild);
    client.channels.cache.get(vars[guild.id]['LG']['villageTextChan']).send("Du fond de sa vieille cabane, la Voyante fait appel à sa magie pour découvrir l'identité secrète de l'un des gens du village.");
    LGgame[guild.id]['voyante']={};
    for(var p in LGgame[guild.id]['players']){
        if (LGgame[guild.id]['players'][p].startingRole=="Voyante"){
            LGgame[guild.id]['players'][p].playerChan.send("Du fond de votre cabane, vous scrutez votre boule de crystal.\nDe qui souhaitez-vous découvrir l'identité secrète ?");
            let playerEmotes={};
            let emoteList=['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🇦','🇧','🇨','🇩','🇪','🇫','🇬'];
            let mess= "";
            for(var o in LGgame[guild.id]['players']){
                if (o!=p){
                    let e=emoteList.splice(0,1);
                    playerEmotes[e]=o;
                    mess+=`\n${e} ${o}`;
                }
            }
            LGgame[guild.id]['voyante'][p]=playerEmotes;
            LGgame[guild.id]['players'][p].playerChan.send(mess).then(message=>{
                for(var e in playerEmotes){
                    message.react(e);
                }
            });
        }
    }
    setTimeout(function(){
        LGtourVoleur(guild);
    }, 30000);     
}

function LGtourVoleur(guild){
    delete LGgame[guild.id]['Voyante'];
    LGgame[guild.id]['step']="voleur";
    if(!LGgame[guild.id]['roleList'].includes("Voleur")) return LGtourNoiseuse(guild);
    client.channels.cache.get(vars[guild.id]['LG']['villageTextChan']).send("Au fond de la nuit, sur la place du village, le Voleur se prépare à usurper l'identité de l'un de ses concitoyens.");
    for(var p in LGgame[guild.id]['players']){
        if (LGgame[guild.id]['players'][p].startingRole=="Voleur"){
            LGgame[guild.id]['players'][p].playerChan.send("Au milieu de la nuit, sur la place du village, vous hésitez. A qui allez-vous donc voler son identité ?");
            LGgame[guild.id]['players'][p].playerChan.send("*Pouvoir indisponnible dans la version bêta*");//TODO choisir un joueur dont on souhaite voler l'identité.
        }
    }
    setTimeout(function(){
        LGtourNoiseuse(guild);
    }, 30000);
}

function LGtourNoiseuse(guild){
    LGgame[guild.id]['step']="noiseuse";
    if(!LGgame[guild.id]['roleList'].includes("Noiseuse")) return LGtourIvrogne(guild);
    client.channels.cache.get(vars[guild.id]['LG']['villageTextChan']).send("Texte général de la noiseuse.");
    for(var p in LGgame[guild.id]['players']){
        if (LGgame[guild.id]['players'][p].startingRole=="Noiseuse"){
            LGgame[guild.id]['players'][p].playerChan.send("Texte personnel de la noiseuse.");
            LGgame[guild.id]['players'][p].playerChan.send("*Pouvoir indisponnible dans la version bêta*");//TODO choisir deux joueurs dont on va échanger les identités.
        }
    }
    setTimeout(function(){
        LGtourIvrogne(guild);
    }, 30000);
}

function LGtourIvrogne(guild){
    LGgame[guild.id]['step']="ivrogne";
    if(!LGgame[guild.id]['roleList'].includes("Ivrogne")) return LGtourInsomniaque(guild);
    client.channels.cache.get(vars[guild.id]['LG']['villageTextChan']).send("Texte général de l'ivrogne.");
    for(var p in LGgame[guild.id]['players']){
        if (LGgame[guild.id]['players'][p].startingRole=="Ivrogne"){
            LGgame[guild.id]['players'][p].playerChan.send("Texte personnel de l'ivrogne.");
            LGgame[guild.id]['players'][p].playerChan.send("*Pouvoir indisponnible dans la version bêta*");//TODO choisir l'exilé dont on va rendre l'identité.
        }
    }
    setTimeout(function(){
        LGtourInsomniaque(guild);
    }, 30000);
}

function LGtourInsomniaque(guild){
    LGgame[guild.id]['step']="insomniaque";
    if(!LGgame[guild.id]['roleList'].includes("Insomniaque")) return LGjourVote(guild);
    client.channels.cache.get(vars[guild.id]['LG']['villageTextChan']).send("Comme à son habitude, l'insomniaque n'a pas dormi, elle sait si son identité a été modifiée.");
    for(var p in LGgame[guild.id]['players']){
        if (LGgame[guild.id]['players'][p].startingRole=="Insomniaque"){
            if(LGgame[guild.id]['players'][p].actualRole=="Insomniaque"){
                LGgame[guild.id]['players'][p].playerChan.send("Avec tout ce bruit dehors, vous n'avez pas fermé l'oeil de la nuit, mais au moins, vous vous êtes assurée que personne ne s'introduisait chez vous, **vous êtes toujours vous même**.");
            }
            else{
                LGgame[guild.id]['players'][p].playerChan.send(`Vous saviez que quelque chose se tramait. Pendant la nuit, votre identité a été volée. Vous êtes désormais **${LGgame[guild.id]['players'][p].actualRole}**`);
            }
        }
    }
    LGjourVote(guild);
}

function LGjourVote(guild){
    LGgame[guild.id]['step']="vote";
    client.channels.cache.get(vars[guild.id]['LG']['villageTextChan']).send("L'heure est grave, le sort du village repose sur l'assemblée d'aujourd'hui.");
    for(var p in LGgame[guild.id]['players']){
        LGgame[guild.id]['players'][p].playerChan.send("Bulletin de vote")//TODO mettre en place le systeme de votes
    }
    setTimeout(function(){
        LGresultatFinal(guild);
    }, 90000);
}

function LGresultatFinal(guild){
    client.channels.cache.get(vars[guild.id]['LG']['villageTextChan']).send("Fin du vote, mais comme personne n'a renvoyé son bulletin, vous êtes tous morts.");//TODO récupérer les résultats de votes et calculer la victoire
    delete LGgame[guild.id];
}

function LGreset(guild){
    LGgame[guild.id]={};
    LGgame[guild.id]['players']={};
    var rolesToRemove= vars[guild.id]['LG']['playerRoles'];
    rolesToRemove.push(vars[guild.id]['LG']['playersRole']);
    rolesToRemove.forEach(roleid =>{
        var role = guild.roles.cache.get(roleid);
        role.members.forEach(member=>{
            console.log(`retrait du role ${role.name} à ${member.displayName}`);
            member.roles.remove(role);            
        });
    });
}