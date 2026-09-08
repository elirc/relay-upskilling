import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const dotnet=process.env.DOTNET_EXE??(existsSync('.tools/dotnet/dotnet.exe')?resolve('.tools/dotnet/dotnet.exe'):'dotnet');
const child=spawn(dotnet,[resolve('worker/bin/Debug/net10.0/Relay.Worker.dll')],{stdio:'inherit',windowsHide:true,env:{...process.env,Relay__UploadDir:resolve(process.env.Relay__UploadDir??process.env.UPLOAD_DIR??'.data/uploads'),DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_CLI_HOME:resolve('.cache/dotnet'),NUGET_PACKAGES:resolve('.cache/nuget')}});
child.on('exit',code=>process.exit(code??0));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());
