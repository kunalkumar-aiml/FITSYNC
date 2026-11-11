// SYNTHETIC layout fixtures. Brand names and numbers are invented test values, NOT brand data.

export const TABLE_BODY_HTML = `<html><body><p>The measurements on the size chart are body measurements.</p>
<table><tr><th>Size</th><th>XS</th><th>S</th><th>M</th><th>L</th></tr>
<tr><td>Chest (in.)</td><td>30 - 32</td><td>32 - 34</td><td>34 - 37</td><td>37 - 40</td></tr>
<tr><td>Waist (in.)</td><td>24 - 26</td><td>26 - 28</td><td>28 - 31</td><td>31 - 34</td></tr></table></body></html>`;

export const TABLE_WOMEN_BUST_HTML = `<html><body><p>Body measurements.</p><table>
<tr><td>Size</td><td>S</td><td>M</td><td>L</td></tr>
<tr><td>Bust (cm)</td><td>82 - 86</td><td>86 - 90</td><td>90 - 95</td></tr>
<tr><td>Hip (cm)</td><td>90 - 94</td><td>94 - 98</td><td>98 - 103</td></tr></table></body></html>`;

export const TABLE_SIZES_DOWN_HTML = `<table><tr><th>Size</th><th>Chest (cm)</th><th>Waist (cm)</th></tr>
<tr><td>S</td><td>90</td><td>76</td></tr><tr><td>M</td><td>96</td><td>82</td></tr><tr><td>L</td><td>102</td><td>88</td></tr></table>`;

export const TABLE_OPEN_ENDED_HTML = `<p>Body measurements.</p><table><tr><th>Size</th><th>XS</th><th>S</th><th>M</th></tr>
<tr><td>Chest (cm)</td><td>&lt;80</td><td>80 - 86</td><td>86 - 92</td></tr></table>`;

export const TABLE_NO_STATEMENT_HTML = `<table><tr><th>Size</th><th>S</th><th>M</th><th>L</th></tr>
<tr><td>Chest (cm)</td><td>90</td><td>96</td><td>102</td></tr></table>`;

export const TABLE_MISALIGNED_HTML = `<p>Body measurements.</p><table><tr><th>Size</th><th>S</th><th>M</th><th>L</th><th>XL</th></tr>
<tr><td>Chest (cm)</td><td>120</td><td>100</td><td>110</td><td>90</td></tr></table>`;

// Pipe style (marketplace listing, inches), like "M  Chest 36 inch | Length 28 inch | Shoulder 16 inch"
export const LISTING_PIPE_TEXT = `Test Brand Slim Fit Tee. Size Chart
M Chest 30 inch | Length 25 inch | Shoulder 14 inch
L Chest 32 inch | Length 26 inch | Shoulder 15 inch
XL Chest 34 inch | Length 27 inch | Shoulder 16 inch
Slim fit`;

// Column style (marketplace listing, cm): header labels then size + values per row
export const LISTING_COLUMN_TEXT = `Size Chart

cm

Size

CHEST

SHOULDER

LENGTH

S

90.0

40.0

60.0

M

95.0

42.0

62.0

Sold Out

L

100.0

44.0

64.0`;

export const LISTING_COLUMN_INCOMPLETE = LISTING_COLUMN_TEXT.replace("\n\n44.0\n\n64.0", "\n\n44.0");
