console.log('Initialisation');
require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
var wd=require("word-definition");
var fs=require('fs');
var vars=require('./vars.json');
var pendingRenames={};
let defaultPrefix="/";

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
});

function LogCommand(msg){
    console.log(`${msg.guild.name}, #${msg.channel.name}, @${msg.member.displayName} : ${msg.content}`); 
}