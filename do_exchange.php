<?php

	// echo var_dump($_POST);

	if (!isset($_POST["uid"]) ||
		!isset($_POST["item_id"])) {
		die("Parameter uid/item_id not found!");
	}

	$exchange_item_url = "http://192.168.1.150:9600/exchange_tickets_item?";

	$exchange_item = file_get_contents($exchange_item_url .
		"role_id=" . $_POST["uid"] .
		"&item_id=" . $_POST["item_id"]);
	$exchange_item = json_decode($exchange_item);
	if (!isset($exchange_item->result)) {
		die("Error getting exchange_item 1!");
	}

	if (0 != $exchange_item->result) {
		die("exchange_item error: " . $exchange_item->result);
	}

	echo "Exchange Successfully!!!";
?>