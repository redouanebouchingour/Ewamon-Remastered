// Hollowmane: a hunched, black-armoured horror wearing a ram-horned bone skull, a wild white mane pouring down its
// back, a red heart-gem in its chest and long bone scythes growing from its forearms.
include <lib.scad>

armor = [0.14, 0.13, 0.15];
armorHi = [0.25, 0.23, 0.26];
flesh = [0.32, 0.14, 0.16];
bone = [0.9, 0.86, 0.72];
boneDk = [0.7, 0.64, 0.5];
horn = [0.3, 0.2, 0.2];
mane = [0.95, 0.95, 0.97];
maneSh = [0.78, 0.78, 0.85];
red = [0.9, 0.06, 0.15];
spark = [0.75, 0.05, 0.2];

// Legs: wide, bent stance; armoured thighs, dark red shins, bone knee spikes, clawed bone toes.
mirror_x() {
  limb([4, 1, 16], [8, -1, 9], 3.4, 2.8, armor);
  limb([8, -1, 9], [9.5, 1, 2.5], 2.6, 2, flesh);
  ell([2.4, 2.4, 2], [8, -1.5, 9.2], armorHi);
  spike([8.6, -2.6, 9.5], [1.2, -2.8, 0.8], 1.1, 0.1, bone);
  spike([9.8, 2.5, 4], [1, 2.4, 0.4], 0.8, 0.1, bone);
  blob([[[2.8, 3.6, 1.5], [9.8, -1, 1.5]], [[2, 2, 1.4], [9.6, 1.5, 1.6]]], armor);
  for (a = [-30, 0, 30]) spike([9.8 + sin(a) * 1.8, -4.2, 1], [sin(a) * 0.8, -2, -0.6], 0.6, 0.05, bone);
}

// Pelvis and hunched torso.
blob([[[6, 4.5, 4], [0, 1, 16]], [[5, 4, 4], [0, 0, 20]]], armor);
blob([[[7.5, 5.5, 5], [0, -1, 26]], [[6, 5, 4], [0, 0.5, 21]]], armor);
// Dark red muscle bands between the armour plates.
for (z = [18.5, 21, 23.5]) ell([4.5 - (23.5 - z) * 0.3, 1, 0.6], [0, -4.6 - (z - 18.5) * 0.25, z], flesh);
// Heart gem.
ell([1.9, 1, 1.9], [0, -6.4, 26], [0.3, 0.02, 0.05]);
ell([1.4, 1, 1.4], [0, -6.9, 26], red);
color("white") translate([-0.4, -7.8, 26.5]) sphere(0.3, $fn = 8);

// Shoulders: spiked pauldrons.
mirror_x() {
  ell([3.8, 3.8, 3.2], [7.5, 0, 28], armor);
  spike([8, 0, 30.5], [0.8, 0.3, 4.2], 1.2, 0.1, armorHi);
  spike([9.8, 0.5, 29], [3, 0.3, 2.4], 1, 0.1, armorHi);
}
// Arms hanging forward and down, ending in claws; a long bone scythe grows from each forearm, curving down and out.
mirror_x() {
  limb([8, 0, 27.5], [11, -3, 21], 2.3, 2, armor);
  limb([11, -3, 21], [12.5, -5, 15], 2, 1.7, flesh);
  for (a = [-30, 0, 30]) spike([12.5 + sin(a), -5.4, 14.6], [sin(a) * 0.6, -1.2, -2.2], 0.5, 0.05, bone);
  spike([11, -2.5, 23], [1, 1.5, 2.5], 0.8, 0.1, bone);
  // Scythe blade: a tapering, curved bone chain.
  chain([[12.2, -3.6, 18.5], [15.5, -3.2, 14.5], [18.5, -2.8, 9.5], [19.6, -2.6, 4.5], [19, -2.6, 1.2]],
        [1.5, 1.4, 1.1, 0.7, 0.15], bone);
  chain([[14.5, -3.8, 15.5], [17.6, -3.4, 10], [18.6, -3.2, 5]], [0.6, 0.5, 0.2], boneDk);
}

// Neck and skull mask, jutting forward.
limb([0, -1, 28], [0, -4.5, 31], 3, 2.6, armor);
blob([[[3.6, 3.6, 3.8], [0, -6, 34]], [[2.4, 2.8, 2.2], [0, -9.2, 31]]], bone);
// Jaw with teeth.
ell([2.6, 2, 1.2], [0, -8.6, 28.8], bone);
color(armor) translate([0, -10.4, 30]) scale([2.2, 0.5, 0.6]) sphere(1, $fn = 14);
for (x = [-1.6 : 0.8 : 1.6]) spike([x, -10.3, 30.6], [0, -0.1, -0.9], 0.3, 0.05, bone);
// Hollow eye sockets with red glints.
mirror_x() {
  ell([1.4, 0.9, 1.2], [1.7, -9.3, 33.5], [0.05, 0.03, 0.04]);
  color(red) translate([1.7, -10.1, 33.4]) sphere(0.6, $fn = 10);
}
color(armor) mirror_x() translate([0.5, -11.2, 31.8]) scale([0.3, 0.3, 0.5]) sphere(1, $fn = 8);
// Ram horns curling back and down round the skull sides.
mirror_x() chain([[2.8, -5.5, 35.5], [5.5, -4, 37], [7.5, -2, 35.5], [7.6, -2.5, 32.5], [6.2, -4.6, 31.5], [5.6, -6, 33]],
                 [1.5, 1.4, 1.2, 1, 0.7, 0.3], horn);

// The mane: a huge mass of white tresses springing from the crown, sweeping back and pouring down to the hips.
ell([7.5, 6.5, 7.5], [0, 4, 32], mane);
ell([7, 5, 7], [0, 7, 22], mane);
// Crown tresses fanning up and out, then falling back.
for (i = [0 : 8]) let(a = -10 + i * 25, ca = cos(a), sa = sin(a), p0 = [ca * 4, 2, 34 + sa * 4],
                       p1 = p0 + [ca * 6, 5, sa * 6 + 2], p2 = p1 + [ca * 4, 5, sa * 2 - 3], p3 = p2 + [ca * 2, 3, -7])
  chain([p0, p1, p2, p3], [3, 2.4, 1.4, 0.2], i % 3 == 1 ? maneSh : mane);
// Back curtain falling to the hips.
for (x = [-7.5 : 2.5 : 7.5]) chain([[x * 0.5, 5, 35], [x, 10, 31], [x * 1.1, 11.5, 21], [x * 1.25, 10, 9 + abs(x) * 0.6]],
                                     [3, 2.8, 2, 0.25], abs(x) == 5 ? maneSh : mane);
// Locks that fall forward past the shoulders, framing the skull.
mirror_x() chain([[4.5, -2, 34], [6, -3.5, 30], [5.8, -3.5, 25], [5, -3, 21]], [2, 1.8, 1.2, 0.2], mane);

// Red sparks of malice drifting round the legs and blades.
for (p = [[-18, -4, 10], [18, -2, 12], [-13, -6, 4], [13, -6, 3], [-17, -1, 18], [16, 0, 19]])
  color(spark) translate(p) rotate([0, 20, 0]) scale([0.25, 0.25, 1.4]) sphere(1, $fn = 6);
