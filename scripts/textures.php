<?php

$text = '{"chunkSize":32,"drawDistance":2,"removeDistance":3,"initialPosition":[16.5,25.5,16.5],"worldRadius":10,"chunkFolder":"/Users/alanszlosek/Projects/voxeling2/chunks/test/","mysql":{"connectionLimit":10,"user":"voxeling","password":"voxeling","database":"voxeling","host":"localhost"},"server":"ws://127.0.0.1:10005","httpServer":"http://127.0.0.1:10005","websocketBindAddress":"127.0.0.1","websocketBindPort":10005,"maxPlayers":10,"voxelRemap":{"16":0,"20":0},"texturePicker":[1,14,17,3,2,4,13,19,18,11,15,7,6,8,22,24,100,27,34,32,29,28,30,33,31,35,39,37,38,21,36,5,101],"voxels":{"1":{"name":"grass+dirt","textures":[14,302,302,302,302,3]},"2":{"name":"brick","src":"/testbdcraft/default_brick.png","textures":[2,2,2,2,2,2]},"3":{"name":"dirt","textures":[3,3,3,3,3,3]},"4":{"name":"coal","textures":[4,4,4,4,4,4]},"5":{"name":"white wool","textures":[5,5,5,5,5,5]},"6":{"name":"water","textures":[6,6,6,6,6,6]},"7":{"name":"lava","textures":[7,7,7,7,7,7]},"8":{"name":"chest","textures":[300,301,301,301,301,301]},"9":{"name":"brick2","textures":[9,9,9,9,9,9],"hidden":true},"10":{"name":"brick3","textures":[10,10,10,10,10,10],"hidden":true},"11":{"name":"cobble","textures":[11,11,11,11,11,11]},"12":{"name":"cobble2","textures":[12,12,12,12,12,12],"hidden":true},"13":{"name":"iron","textures":[13,13,13,13,13,13]},"14":{"name":"grass","textures":[14,14,14,14,14,14]},"15":{"name":"moss cobble","textures":[15,15,15,15,15,15]},"16":{"name":"ice","textures":[16,16,16,16,16],"hidden":true},"17":{"name":"grass2","textures":[17,17,17,17,17,17]},"18":{"name":"sandstone","textures":[18,18,18,18,18,18]},"19":{"name":"clay","textures":[19,19,19,19,19,19]},"20":{"name":"snow","textures":[20,20,20,20,20,20],"hidden":true},"21":{"name":"yellow wool","textures":[21,21,21,21,21,21]},"22":{"name":"wood","textures":[22,22,22,22,22,22]},"24":{"name":"tree","textures":[303,304,304,304,304,303]},"27":{"name":"black wool","textures":[27,27,27,27,27,27]},"28":{"name":"blue wool","textures":[28,28,28,28,28,28]},"29":{"name":"brown wool","textures":[29,29,29,29,29,29]},"30":{"name":"cyan wool","textures":[30,30,30,30,30,30]},"31":{"name":"dk green wool","textures":[31,31,31,31,31,31]},"32":{"name":"dk grey wool","textures":[32,32,32,32,32,32]},"33":{"name":"green wool","textures":[33,33,33,33,33,33]},"34":{"name":"grey wool","textures":[34,34,34,34,34,34]},"35":{"name":"magenta wool","textures":[35,35,35,35,35,35]},"36":{"name":"orange wool","textures":[36,36,36,36,36,36]},"37":{"name":"pink wool","textures":[37,37,37,37,37,37]},"38":{"name":"red wool","textures":[38,38,38,38,38,38]},"39":{"name":"violet wool","textures":[39,39,39,39,39,39]},"100":{"name":"leaves","textures":[100,100,100,100,100,100]},"101":{"name":"glass","textures":[101,101,101,101,101,101]}},"textures":{"2":"/testbdcraft/default_brick.png","3":"/testbdcraft/default_dirt.png","4":"/testbdcraft/default_mineral_coal.png","5":"/testbdcraft/wool_white.png","6":"/testbdcraft/default_water.png","7":"/testbdcraft/default_lava.png","9":"/testbdcraft/default_brick.png","10":"/testbdcraft/default_brick.png","11":"/testbdcraft/default_cobble.png","12":"/testbdcraft/default_cobble.png","13":"/testbdcraft/default_mineral_iron.png","14":"/testbdcraft/default_grass.png","15":"/testbdcraft/default_mossycobble.png","17":"/testbdcraft/default_grass_footsteps.png","18":"/testbdcraft/default_sandstone.png","19":"/testbdcraft/default_clay.png","21":"/testbdcraft/wool_yellow.png","22":"/testbdcraft/default_wood.png","27":"/testbdcraft/wool_black.png","28":"/testbdcraft/wool_blue.png","29":"/testbdcraft/wool_brown.png","30":"/testbdcraft/wool_cyan.png","31":"/testbdcraft/wool_dark_green.png","32":"/testbdcraft/wool_dark_grey.png","33":"/testbdcraft/wool_green.png","34":"/testbdcraft/wool_grey.png","35":"/testbdcraft/wool_magenta.png","36":"/testbdcraft/wool_orange.png","37":"/testbdcraft/wool_pink.png","38":"/testbdcraft/wool_red.png","39":"/testbdcraft/wool_violet.png","100":"/testbdcraft/default_leaves.png","101":"/textures/glass.png","300":"/testbdcraft/default_chest_top.png","301":"/testbdcraft/default_chest_side.png","302":"/testbdcraft/default_grass_side.png","303":"/testbdcraft/default_tree_top.png","304":"/testbdcraft/default_tree.png"},"players":{"1001":{"name":"player","src":"/textures/player.png","hidden":true},"1002":{"name":"substack","src":"/textures/substack.png","hidden":true},"1003":{"value":52,"name":"viking","src":"/textures/viking.png","hidden":true}}}';

$json = json_decode($text, true);
//var_dump($json);exit;

$numTextures = count($json['textures']);
//var_dump($numTextures);exit;

$width = 128;
$desiredHeight = 128 * $numTextures;
$height = 128;


while ($height < $desiredHeight) {
    $height = $height<<1;
}


$combined = imagecreatetruecolor($width, $height);
imagealphablending($combined, false);
$col = imagecolorallocatealpha($combined, 255, 255, 255, 127);
imagefilledrectangle($combined, 0, 0, $width, $height, $col);
imagealphablending($combined, true);

$yOffset = 0;
$out = array();
foreach ($json['textures'] as $value => $path) {
            
    $image = imagecreatefrompng('../www' . $path);
    
    // bool imagecopyresampled ($dst_image, $src_image, $dst_x, $dst_y, $src_x, $src_y, $dst_w, $dst_h, $src_w, $src_h )
    imagecopyresampled($combined, $image, 0, $yOffset, 0, 0, $width, $width, imagesx($image), imagesy($image));
    imagealphablending($combined, true);

    $texcoordHeight = 128 / $height;
    $texcoordTop = $yOffset / $height;
    // texture bottom-most pixel is 1 pix less than texture height
    $texcoordBottom = $texcoordTop + (127 / $height);

    $out[$value] = [$texcoordBottom, $texcoordTop, 1.0];
    $yOffset += $width;
}
file_put_contents('../texture-offsets.js', 'module.exports=' . json_encode($out));

imagesavealpha($combined, true);
imagepng($combined, '../www/textures.png');
