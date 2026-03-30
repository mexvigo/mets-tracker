const METS_TEAM_ID=121;
const MLB_API="https://statsapi.mlb.com/api/v1";
const POLL_INTERVAL_LIVE=15000;
const POLL_INTERVAL_IDLE=60000;
let currentPoll=null;
const noGameEl=document.getElementById("no-game");
const scoreboardEl=document.getElementById("scoreboard-wrapper");
const citiField=document.getElementById("citi-field");
const hellStadium=document.getElementById("hell-stadium");
const homeBoardEl=document.getElementById("home-board");
const awayBoardEl=document.getElementById("away-board");
const gameStatusEl=document.getElementById("game-status");
const lastUpdateEl=document.getElementById("last-update");
const seasonRecordEl=document.getElementById("season-record");
const lastResultEl=document.getElementById("last-result");
init();
async function init(){showStatus("Searching for Mets game...");await fetchSeasonInfo();await fetchAndRender()}
async function fetchSeasonInfo(){
try{
const year=new Date().getFullYear();
const standingsUrl=`${MLB_API}/standings?leagueId=104&season=${year}&standingsTypes=regularSeason`;
const res=await fetch(standingsUrl);
if(!res.ok)return;
const data=await res.json();
let record=null;
for(const div of data.records||[]){
for(const tr of div.teamRecords||[]){
if(tr.team.id===METS_TEAM_ID){record=tr;break}
}if(record)break;
}
if(record){
seasonRecordEl.textContent=`${record.wins}-${record.losses}`;
}
}catch(e){console.error("Standings error:",e)}
try{
const today=new Date();
const end=today.toISOString().slice(0,10);
const start=new Date(today);start.setDate(start.getDate()-7);
const startStr=start.toISOString().slice(0,10);
const url=`${MLB_API}/schedule?sportId=1&startDate=${startStr}&endDate=${end}&teamId=${METS_TEAM_ID}&hydrate=team,linescore`;
const res=await fetch(url);
if(!res.ok)return;
const data=await res.json();
let lastGame=null;
for(const d of (data.dates||[]).reverse()){
for(const g of (d.games||[]).reverse()){
if(g.status.abstractGameState==="Final"){lastGame=g;break}
}if(lastGame)break;
}
if(lastGame){
const away=lastGame.teams.away;
const home=lastGame.teams.home;
const aR=away.score??0;
const hR=home.score??0;
const metsAway=away.team.id===METS_TEAM_ID;
const metsWon=metsAway?(aR>hR):(hR>aR);
const cls=metsWon?"result-w":"result-l";
const tag=metsWon?"W":"L";
const dateStr=new Date(lastGame.gameDate).toLocaleDateString([],{month:"numeric",day:"numeric"});
const opp=metsAway?home.team.abbreviation:away.team.abbreviation;
const metsR=metsAway?aR:hR;
const oppR=metsAway?hR:aR;
lastResultEl.innerHTML=`LAST: <span class="${cls}">${tag} ${metsR}-${oppR}</span> vs ${opp} (${dateStr})`;
}
}catch(e){console.error("Last game error:",e)}
}
async function fetchAndRender(){
try{
const game=await getTodaysMetsGame();
if(!game){showNoGame();schedulePoll(POLL_INTERVAL_IDLE);return}
const liveData=await getLiveGameData(game.gamePk);
renderScoreboard(liveData,game);
const status=liveData.gameData.status.abstractGameState;
if(status==="Live"){schedulePoll(POLL_INTERVAL_LIVE)}
else if(status==="Final"){showStatus("FINAL");refreshSeasonInfo();schedulePoll(POLL_INTERVAL_IDLE)}
else{schedulePoll(POLL_INTERVAL_IDLE)}
}catch(err){console.error("Fetch error:",err);showStatus("Error - retrying...");schedulePoll(POLL_INTERVAL_IDLE)}
}
function schedulePoll(interval){if(currentPoll)clearTimeout(currentPoll);currentPoll=setTimeout(fetchAndRender,interval)}
async function getTodaysMetsGame(){
const today=new Date().toISOString().slice(0,10);
const url=`${MLB_API}/schedule?sportId=1&date=${today}&teamId=${METS_TEAM_ID}&hydrate=team,linescore`;
const res=await fetch(url);
if(!res.ok)throw new Error(`Schedule API ${res.status}`);
const data=await res.json();
if(!data.dates||data.dates.length===0)return null;
const games=data.dates[0].games;
if(!games||games.length===0)return null;
const liveGame=games.find(g=>g.status.abstractGameState==="Live");
return liveGame||games[0];
}
async function getLiveGameData(gamePk){
const url=`${MLB_API}.1/game/${gamePk}/feed/live`;
const res=await fetch(url);
if(!res.ok)throw new Error(`Live API ${res.status}`);
return res.json();
}
function renderScoreboard(liveData,scheduleGame){
const gd=liveData.gameData;
const ld=liveData.liveData;
const linescore=ld.linescore;
const awayTeam=gd.teams.away;
const homeTeam=gd.teams.home;
const isHome=homeTeam.id===METS_TEAM_ID;
const gameState=gd.status.abstractGameState;
const detailedState=gd.status.detailedState;
noGameEl.classList.add("hidden");
scoreboardEl.classList.remove("hidden");
if(isHome){citiField.style.display="";hellStadium.style.display="none"}
else{citiField.style.display="none";hellStadium.style.display=""}
const boardEl=isHome?homeBoardEl:awayBoardEl;
const innings=linescore.innings||[];
const numInnings=Math.max(innings.length,9);
const currentInning=linescore.currentInning||0;
const isTopInning=linescore.isTopInning;
let html='<div class="sb-teams" style="--innings:'+numInnings+'">';
html+='<div class="sb-cell sb-header"></div>';
for(let i=1;i<=numInnings;i++){html+=`<div class="sb-cell sb-header">${i}</div>`}
html+='<div class="sb-cell sb-header">R</div><div class="sb-cell sb-header">H</div><div class="sb-cell sb-header">E</div>';
const awayIsM=awayTeam.id===METS_TEAM_ID;
html+=`<div class="sb-cell sb-team-name ${awayIsM?"mets":""}">${awayTeam.abbreviation}</div>`;
for(let i=0;i<numInnings;i++){
const inn=innings[i];
const runs=inn?(inn.away.runs!==undefined?inn.away.runs:""):"";
const isCurrent=(gameState==="Live"&&(i+1)===currentInning&&isTopInning);
html+=`<div class="sb-cell sb-score ${isCurrent?"current-inning":""}">${runs}</div>`;
}
html+=`<div class="sb-cell sb-total">${linescore.teams?.away?.runs??""}</div>`;
html+=`<div class="sb-cell sb-total">${linescore.teams?.away?.hits??""}</div>`;
html+=`<div class="sb-cell sb-total">${linescore.teams?.away?.errors??""}</div>`;
const homeIsM=homeTeam.id===METS_TEAM_ID;
html+=`<div class="sb-cell sb-team-name ${homeIsM?"mets":""}">${homeTeam.abbreviation}</div>`;
for(let i=0;i<numInnings;i++){
const inn=innings[i];
const runs=inn?(inn.home.runs!==undefined?inn.home.runs:""):"";
const isCurrent=(gameState==="Live"&&(i+1)===currentInning&&!isTopInning);
html+=`<div class="sb-cell sb-score ${isCurrent?"current-inning":""}">${runs}</div>`;
}
html+=`<div class="sb-cell sb-total">${linescore.teams?.home?.runs??""}</div>`;
html+=`<div class="sb-cell sb-total">${linescore.teams?.home?.hits??""}</div>`;
html+=`<div class="sb-cell sb-total">${linescore.teams?.home?.errors??""}</div>`;
html+="</div>";
if(gameState==="Live"){
const balls=linescore.balls??0;
const strikes=linescore.strikes??0;
const outs=linescore.outs??0;
const offense=linescore.offense||{};
const b1=!!offense.first;
const b2=!!offense.second;
const b3=!!offense.third;
html+='<div class="sb-info">';
html+=`<div class="sb-inning-display"><span class="sb-arrow ${isTopInning?"top":"bottom"}"></span> <span>${currentInning}</span></div>`;
html+=`<div class="sb-count"><div>B: <span>${balls}</span></div><div>S: <span>${strikes}</span></div></div>`;
html+=`<div class="sb-bases"><div class="base base-second ${b2?"occupied":""}"></div><div class="base base-third ${b3?"occupied":""}"></div><div class="base base-first ${b1?"occupied":""}"></div></div>`;
html+='<div class="sb-outs">OUT: ';
for(let i=0;i<3;i++){html+=`<div class="out-dot ${i<outs?"active":""}"></div>`}
html+="</div></div>";
}else if(gameState==="Preview"){
const gameTime=new Date(gd.datetime.dateTime);
const timeStr=gameTime.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
html+=`<div class="sb-info"><span>FIRST PITCH: ${timeStr}</span><span>${detailedState}</span></div>`;
}else if(gameState==="Final"){
html+=`<div class="sb-info"><span>FINAL${innings.length>9?" ("+innings.length+")":""}</span><span>${detailedState}</span></div>`;
}
boardEl.innerHTML=html;
if(gameState==="Live"){
const halfInning=isTopInning?"Top":"Bot";
showStatus(`LIVE: ${halfInning} ${currentInning} \u2014 ${awayTeam.abbreviation} ${linescore.teams?.away?.runs??0} @ ${homeTeam.abbreviation} ${linescore.teams?.home?.runs??0}`);
}else if(gameState==="Final"){
showStatus(`FINAL: ${awayTeam.abbreviation} ${linescore.teams?.away?.runs??0} @ ${homeTeam.abbreviation} ${linescore.teams?.home?.runs??0}`);
}else{
const gameTime=new Date(gd.datetime.dateTime);
const timeStr=gameTime.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
showStatus(`NEXT: ${awayTeam.abbreviation} @ ${homeTeam.abbreviation} \u2014 ${timeStr}`);
}
updateTimestamp();
}
function showNoGame(){noGameEl.classList.remove("hidden");scoreboardEl.classList.add("hidden");showStatus("No Mets game scheduled today");updateTimestamp()}
async function refreshSeasonInfo(){try{await fetchSeasonInfo()}catch(e){}}
function showStatus(msg){gameStatusEl.textContent=msg}
function updateTimestamp(){const now=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit",second:"2-digit"});lastUpdateEl.textContent="Updated: "+now}
