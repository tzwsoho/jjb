<?php

	if (isset($_SERVER['HTTP_REFERER'])) {
		echo $_SERVER['HTTP_REFERER'];
	}

	if (!isset($_GET["uid"])) {
		die("Parameter uid not found!");
	}

	$item_list_url = "http://192.168.1.150:9600/get_item_list?role_id=";
	$get_tickets_url = "http://192.168.1.150:9600/get_tickets?role_id=";

	$item_list = file_get_contents($item_list_url . $_GET["uid"]);
	$item_list = json_decode($item_list);
	if (!isset($item_list->result)) {
		die("Error getting item_list 1!");
	}

	if (0 != $item_list->result) {
		die("item_list error: " . $item_list->result);
	}

	if (!isset($item_list->items) ||
		!is_array($item_list->items)) {
		die("Error getting item_list 2!");
	}
		
	$get_tickets = file_get_contents($get_tickets_url . $_GET["uid"]);
	$get_tickets = json_decode($get_tickets);
	if (!isset($get_tickets->result)) {
		die("Error getting tickets 1!");
	}

	if (0 != $get_tickets->result) {
		die("get_tickets error: " . $get_tickets->result);
	}

	if (!isset($get_tickets->role_id) ||
		!isset($get_tickets->name) ||
		!isset($get_tickets->tickets)) {
		die("Error getting tickets 2!");
	}

	// FOR TEST
	// $item_list = json_encode("{result:0,items:[{item_id:0,name:\"话费10元\"}]}");
	// $get_tickets = json_encode("{result:0,name:\"11223344\",tickets:12345}");
?>

<html>
<head></head>
<body>
	<form action="do_exchange.php" method="post">
		<p>
			<label>UID：</label>
			<font color="red" style="font-weight:bold;">
			<?php echo $get_tickets->role_id; ?>
			</font>
			<label>昵称：</label>
			<font color="red" style="font-weight:bold;">
			<?php echo $get_tickets->name; ?>
			</font>
			<label>当前奖券：</label>
			<font color="red" style="font-weight:bold;">
			<?php echo $get_tickets->tickets; ?>
			</font>
		</p>
		<p>
			<label>选择要兑换的商品：</label>
			<select name="item_id">
			<?php
				foreach ($item_list->items as $i => $item) {
					// if ($item->tickets > $get_tickets->tickets) {
						// continue;
					// }

					echo "<option value=\"{$item->item_id}\">{$item->name}(花费 {$item->tickets} 奖券)</option>";
				}
			?>
			</select>
			<input name="uid" value="<?php echo $get_tickets->role_id; ?>" readonly hidden />
			<input type="submit" value="兑换"></input>
		</p>
	</form>
</body>
</html>