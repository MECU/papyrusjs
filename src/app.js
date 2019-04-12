const json_package = require( '../package.json' );
const yargs        = require( 'yargs' );
const fs           = require( 'fs' );
const path         = require( 'path' );
const readline     = require( 'readline' );
const colors       = require( 'colors' );
const Spinner      = require( 'cli-spinner' ).Spinner;
const marky        = require( 'marky' );
const SmartBuffer  = require( 'smart-buffer' ).SmartBuffer;

yargs.parse();

var rl = readline.createInterface( process.stdin, process.stdout );

console.log( colors.bold( json_package.name.charAt( 0 )/*.toUpperCase()*/ + json_package.name.slice( 1, json_package.name.length - 2 ) + '.' + json_package.name.slice( json_package.name.length - 2 ) + ' v' + json_package.version + json_package.version_devstate.charAt( 0 ) ) + colors.reset( ' by ' ) + json_package.author );
yargs.version( json_package.version + json_package.version_devstate.charAt( 0 ) );

// Require more libraries
var spinner = new Spinner();
spinner.setSpinnerString( 0 );

spinner.setSpinnerTitle( 'Loading libraries... %s' );
spinner.start();

var libraries_loaded = 0;
let string_libraries;

const levelup           = require( 'levelup' );                      libraries_loaded++;
const Jimp              = require( 'jimp' );                         libraries_loaded++;
const Chunk             = require( './palettes/chunk.js' );
const nbt               = require( 'prismarine-nbt' );               libraries_loaded++;
const Vec3              = require( 'vec3' );                         libraries_loaded++;

if ( libraries_loaded == 1 )
{
    string_libraries = 'library';
} else {
    string_libraries = 'libraries';
};

spinner.stop();

console.log( '\n' + colors.green( 'Successfully' ) + colors.reset( ' loaded ' + libraries_loaded + ' ' + string_libraries + '.' ) );
console.log( 'Type "help" to get started.');

rl.prompt();

rl.on( 'line', function( str_in ) {

    // COMMAND: help
    if        ( str_in == 'help' )
    {
        console.log( '\nExample usage:')
        console.log( '-path "MyWorld" --mode=papyrus\n' )
        console.log( 'Command list:\n   help: Displays help\n   exit: Closes ' + json_package.name.charAt( 0 ).toUpperCase() + json_package.name.slice( 1 ) + '\n\nParameters:\n   --path: Path to your world save\n   --output: Output directory for rendered Map\n   --mode: "papyrus" or "vanilla" (all chunks or ingame maps only)\n   --textures: Path to .mcpack folder containing the textures' );
    // COMMAND: exit
    } else if ( str_in == 'exit' )
    {
        console.log( 'Exiting...' );
        process.exit();
    } else
    // COMMAND: everything else
    {
        init( str_in );
    };
} );

function init( path_world ) {
    var path_leveldat = path.normalize( path_world + '/level.dat' );
    if ( fs.existsSync( path_leveldat ) != 1 )
    {
        app_error( 'Invalid path. No "level.dat" found.' );
    } else {

        const db = levelup( new ( require( './leveldb-mcpe_ZlibRaw.js' ) )( path.normalize( path_world + '/db/' ) ) );

        console.log( 'Reading database. This can take a couple of seconds up to a couple of minutes.' );

        var db_keys           = [],
            db_keys_subchunks = [],
            chunkX_max        = [],
            chunkZ_max        = [],
            SAFE_MAX          = 65535;

        chunkX_max[ 0 ] = 0;
        chunkX_max[ 1 ] = 0;
        chunkZ_max[ 0 ] = 0;
        chunkZ_max[ 1 ] = 0;

        db.createKeyStream()
            .on( 'data' , function( data ) {

                db_keys.push( data );

                var key = SmartBuffer.fromBuffer( data );

                var key_chunkX = key.readInt32LE(),
                    key_chunkZ = key.readInt32LE();

                if        ( key_chunkX < chunkX_max[ 0 ] )
                {
                    chunkX_max[ 0 ] = key_chunkX;
                } else if ( key_chunkX > chunkX_max[ 1 ] && !( key_chunkX > SAFE_MAX ) )
                {
                    chunkX_max[ 1 ] = key_chunkX;
                };

                if        ( key_chunkZ < chunkZ_max[ 0 ] )
                {
                    chunkZ_max[ 0 ] = key_chunkZ;
                } else if ( key_chunkZ > chunkZ_max[ 1 ] && !( key_chunkZ > SAFE_MAX ) )
                {
                    chunkZ_max[ 1 ] = key_chunkZ;
                };

                // console.log( 'Key:\t' + db_keys.length + '\tBuffer:\t' + key.toString( 'hex' ) + '\tChunk X:\t' + key_chunkX.toString() + '\tChunk Z:\t' + key_chunkZ.toString() );

                // console.log( data );

            } ).on ( 'end', async function() {

                // Validate SubChunk-Keys
                console.log( 'Validating...' );
                for( i = 0; i < db_keys.length; i++ )
                {
                    // console.log( db_keys[ i ].length );
                    if ( db_keys[ i ].readInt8( 8 ) == 47 )
                    {
                        db_keys_subchunks.push( db_keys[ i ] );
                    };
                };

                console.log( 'Found ' + colors.bold( db_keys.length ) + ' keys, which ' + colors.bold( db_keys_subchunks.length ) + ' of them are valid SubChunks.' );
                console.log( 'Furthest X (negative):\t' + chunkX_max[ 0 ].toString() + '\t Furthest Z (negative):\t' + chunkZ_max[ 0 ].toString() + '\nFurthest X (positive):\t' + chunkX_max[ 1 ].toString() + '\t Furthest Z (positive):\t' + chunkZ_max[ 1 ].toString() );

                // Free up memory
                db_keys  = null;


                // Construct Chunks out of SubChunks & Render each one
                module.exports = { db };
                
                console.log( 'Constructing Chunks...' );
                marky.mark( 'task_construct' );

                var chunkIndex = { };
                const readChunk = require( './db_read/readChunk.js' );

                await db_keys_subchunks.forEach( function( key ) {
                    var chunkXZ = key.slice( 0, 8 );

                    if ( !chunkIndex[ chunkXZ.toString( 'hex' ) ] )
                    {
                        // console.log( 'Chunk array for\tX:\t' + chunkXZ.readInt32LE( 0 ) + '\tZ:\t' + chunkXZ.readInt32LE( 4 ) + '\tdoes not exist.' );
                        chunkIndex[ chunkXZ.toString( 'hex' ) ] = new Chunk();
                    };

                    readChunk( Buffer.from( key ), chunkIndex[ chunkXZ.toString( 'hex' ) ] );
                } );
                       
                var renderChunk = require( './render/renderChunk' ); 
               
                // renderChunk( chunkIndex[ db_keys_subchunks[ 0 ].slice( 0, 8 ).toString( 'hex' ) ], 16, 0, 1 );


                // console.log( 'Length: ' + chunkArray.length );

                var time_entry = marky.stop( 'task_construct' );
                console.log( 'Done.' );

                console.log( chunkIndex[ db_keys_subchunks[ 0 ].slice( 0, 8 ).toString( 'hex' ) ].list() );
                
                console.log( 'Constructed ' + Object.keys( chunkIndex ).length + ' Chunks in ' + Math.floor( time_entry.duration * 0.001 ) + ' seconds.' );

            } );

        // db.close();
        
        


        

        // console.log( 'Done.' );
        /*
        // DEBUG

        var debug_dir_temp = './dev/temp/',
            debug_dir_out  = './dev/out/',
            debug_path_rp  = './dev/Vanilla_Resource_Pack_1.10.0/';

        var path_textures = path.normalize( /* argv.textures + */ /* '/textures/blocks/' ),
            ext_textures  = '.png';

        render_current = 0;
        render_total   = 0;

        marky.mark( 'task_render' );

        console.log( 'Initializing render process...' );

        module.exports  = { Jimp, path };
        var renderInit  = require( './render/renderInit'  );
        var renderChunk = require( './render/renderChunk' );
        
        renderInit( path.normalize( debug_path_rp + path_textures ), ext_textures, function( err ) {

        } );

        var time_entry = marky.stop( 'task_render' );
        
        console.log( colors.green( 'Finished' ) + colors.reset( ' rendering process in ' + ( time_entry.duration*0.001 ).toFixed( 2 ) + ' seconds.' ) );

        // 

        */
    };
};

function app_error( err ) {
    console.log( colors.red.bold( 'AN ERROR OCCURED:\n' ) + colors.reset( err ) );
};