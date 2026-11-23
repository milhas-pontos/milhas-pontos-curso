(() => {
	function groupDigits(digits) {
		return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	}

	function formatIntegerInput(raw) {
		var digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
		return digits ? groupDigits(digits) : "";
	}

	function formatMoneyInput(raw) {
		var digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
		if (!digits) return "";
		while (digits.length < 3) digits = `0${digits}`;
		return `${groupDigits(digits.slice(0, -2))},${digits.slice(-2)}`;
	}

	function formatDecimalInput(raw) {
		var cleaned = raw.replace(/\./g, "").replace(/[^\d,]/g, "");
		var comma = cleaned.indexOf(",");
		var ints = comma >= 0 ? cleaned.slice(0, comma) : cleaned;
		var decimals =
			comma >= 0
				? cleaned
						.slice(comma + 1)
						.replace(/\D/g, "")
						.slice(0, 4)
				: null;
		ints = ints.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
		if (!ints && decimals === null) return "";
		var formatted = groupDigits(ints || "0");
		return decimals === null ? formatted : `${formatted},${decimals}`;
	}

	function caretAfterDigits(formatted, digitCount) {
		var seen = 0;
		var index;
		if (digitCount <= 0) return 0;
		for (index = 0; index < formatted.length; index += 1) {
			if (/\d/.test(formatted.charAt(index))) seen += 1;
			if (seen >= digitCount) return index + 1;
		}
		return formatted.length;
	}

	function applyMask(input) {
		var formatted =
			input.dataset.mask === "decimal"
				? formatDecimalInput(input.value)
				: formatIntegerInput(input.value);
		var caret = input.selectionStart || 0;
		var digitsBefore = input.value.slice(0, caret).replace(/\D/g, "").length;
		if (formatted === input.value) return;
		input.value = formatted;
		if (input === document.activeElement) {
			caret = caretAfterDigits(formatted, digitsBefore);
			input.setSelectionRange(caret, caret);
		}
	}

	function countDigitsBefore(value, caret) {
		return value.slice(0, caret).replace(/\D/g, "").length;
	}

	function mapMoneyCaret(raw, caretIndex) {
		var leadingMatch;
		var leading;
		var significant;
		var pad;
		if (!raw) return { digits: "", caret: 0 };
		leadingMatch = raw.match(/^0*/);
		leading = leadingMatch ? leadingMatch[0].length : 0;
		significant = raw.slice(leading);
		if (!significant) return { digits: "000", caret: caretIndex <= 0 ? 0 : 3 };
		pad = significant.length < 3 ? 3 - significant.length : 0;
		return {
			digits: new Array(pad + 1).join("0") + significant,
			caret: Math.min(
				pad + caretIndex - Math.min(leading, caretIndex),
				pad + significant.length,
			),
		};
	}

	function paintMoney(input, raw, caretInRaw) {
		var mapped = mapMoneyCaret(raw, caretInRaw);
		var formatted = mapped.digits ? formatMoneyInput(mapped.digits) : "";
		var caret = formatted ? caretAfterDigits(formatted, mapped.caret) : 0;
		input.value = formatted;
		input.dataset.moneyValue = formatted;
		if (input === document.activeElement) input.setSelectionRange(caret, caret);
	}

	function editMoneyDigits(digits, start, text) {
		var chars = digits.split("");
		var added = text.split("");
		if (start < chars.length) {
			chars.splice(start, Math.min(chars.length - start, added.length));
			chars = chars.slice(0, start).concat(added, chars.slice(start));
		} else {
			chars = chars.concat(added);
		}
		return { raw: chars.join(""), caret: start + added.length };
	}

	function diffChange(previous, current) {
		var prefix = 0;
		var suffix = 0;
		var maxPrefix = Math.min(previous.length, current.length);
		while (
			prefix < maxPrefix &&
			previous.charAt(prefix) === current.charAt(prefix)
		)
			prefix += 1;
		while (
			suffix < previous.length - prefix &&
			suffix < current.length - prefix &&
			previous.charAt(previous.length - 1 - suffix) ===
				current.charAt(current.length - 1 - suffix)
		) {
			suffix += 1;
		}
		return {
			prefix: prefix,
			inserted: current.slice(prefix, current.length - suffix),
			deleted: previous.slice(prefix, previous.length - suffix),
		};
	}

	function handleMoneyInput(input) {
		var previous = input.dataset.moneyValue || "";
		var current = input.value;
		var caret = input.selectionStart || 0;
		var change;
		var edited;
		if (current === previous) return;
		change = diffChange(previous, current);
		if (change.inserted && !change.deleted && /^\d+$/.test(change.inserted)) {
			edited = editMoneyDigits(
				previous.replace(/\D/g, ""),
				countDigitsBefore(previous, change.prefix),
				change.inserted,
			);
			paintMoney(input, edited.raw, edited.caret);
			return;
		}
		paintMoney(
			input,
			current.replace(/\D/g, ""),
			countDigitsBefore(current, caret),
		);
	}

	function readNumber(input) {
		var value = input.value.trim().replace(/[^\d,.-]/g, "");
		var parts;
		if (!value) return NaN;

		var comma = value.lastIndexOf(",");
		var dot = value.lastIndexOf(".");

		if (comma >= 0 && dot >= 0) {
			if (comma > dot) {
				value = value.replace(/\./g, "").replace(",", ".");
			} else {
				value = value.replace(/,/g, "");
			}
		} else if (comma >= 0) {
			value = value.replace(",", ".");
		} else if (dot >= 0) {
			parts = value.split(".");
			if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
				value = parts.join("");
			}
		}

		return Number(value);
	}

	function formatNumber(value, decimals) {
		if (!Number.isFinite(value)) return "—";
		return new Intl.NumberFormat("pt-BR", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		}).format(value);
	}

	function formatMoney(value) {
		if (!Number.isFinite(value)) return "—";
		return new Intl.NumberFormat("pt-BR", {
			style: "currency",
			currency: "BRL",
		}).format(value);
	}

	function officialMileReference(option) {
		var key = option && option.value ? option.value : "";
		var table = window.MILE_REFERENCES;
		var value;
		if (key && table && Object.prototype.hasOwnProperty.call(table, key)) {
			value = Number(table[key]);
			if (Number.isFinite(value)) return value;
		}
		return option ? Number(option.dataset.reference) : NaN;
	}

	function formatEuro(value) {
		if (!Number.isFinite(value)) return "—";
		return `€ ${formatNumber(value, 2)}`;
	}

	function formatPoints(value) {
		if (!Number.isFinite(value)) return "—";
		var whole = Math.abs(value - Math.round(value)) < 0.001;
		return formatNumber(value, whole ? 0 : 2);
	}

	function setOutput(calculator, name, value) {
		var output = calculator.querySelector(`[data-output="${name}"]`);
		if (output) output.textContent = value;
	}

	function setNegative(calculator, name, isNegative) {
		var output = calculator.querySelector(`[data-output="${name}"]`);
		if (output)
			output
				.closest(".calculator-result")
				.classList.toggle("negative", isNegative);
	}

	function value(calculator, name) {
		return readNumber(calculator.querySelector(`[name="${name}"]`));
	}

	var cardPresets = {
		"nubank-ultravioleta": { cashback: "1,25", points: "2,2" },
		"nubank-croma": { cashback: "0,8", points: "1,4" },
		"santander-unique": { cashback: "1,20", points: "2,2" },
		"revolut-ultra": { cashback: "0", points: "3" },
	};

	function applyCardPreset(calculator) {
		var card = calculator.querySelector('[name="card"]');
		var preset = card ? cardPresets[card.value] : null;
		var cashback = calculator.querySelector('[name="cashback"]');
		var points = calculator.querySelector('[name="points"]');
		if (!preset) return;
		if (cashback) cashback.value = preset.cashback;
		if (points) points.value = preset.points;
	}

	function calculateCreditCard(calculator) {
		var purchase = value(calculator, "purchase");
		var cashbackRate = value(calculator, "cashback");
		var pointsRate = value(calculator, "points");
		var dollar = value(calculator, "dollar");
		var cashback =
			purchase >= 0 && cashbackRate >= 0
				? (purchase * cashbackRate) / 100
				: NaN;
		var points =
			purchase >= 0 && pointsRate >= 0 && dollar > 0
				? Math.round((purchase / dollar) * pointsRate)
				: NaN;
		var spendPerThousand =
			pointsRate > 0 && dollar > 0 ? (dollar * 1000) / pointsRate : NaN;
		var cashbackOnThousand =
			Number.isFinite(spendPerThousand) && cashbackRate >= 0
				? (spendPerThousand * cashbackRate) / 100
				: NaN;

		setOutput(calculator, "cashback", formatMoney(cashback));
		setOutput(calculator, "points", formatNumber(points, 0));
		setOutput(calculator, "spend-per-thousand", formatMoney(spendPerThousand));
		setOutput(calculator, "cashback-on-thousand", formatMoney(cashbackOnThousand));
	}

	function calculateCardMiles(calculator) {
		var purchase = value(calculator, "purchase");
		var pointsRate = value(calculator, "points-rate");
		var dollar = value(calculator, "dollar");
		var feeRate = value(calculator, "fee-rate");
		var programField = calculator.querySelector('[name="program"]');
		var option =
			programField && programField.selectedOptions
				? programField.selectedOptions[0]
				: null;
		var reference = officialMileReference(option);
		var note = calculator.querySelector("[data-reference-note]");
		var fee = purchase >= 0 && feeRate >= 0 ? (purchase * feeRate) / 100 : NaN;
		var points =
			purchase >= 0 && pointsRate >= 0 && dollar > 0
				? Math.round((purchase / dollar) * pointsRate)
				: NaN;
		var cpm = Number.isFinite(fee) && points > 0 ? (fee / points) * 1000 : NaN;

		if (note) note.classList.toggle("is-blank", !Number.isFinite(reference));
		setOutput(
			calculator,
			"reference",
			Number.isFinite(reference) ? formatMoney(reference) : "—",
		);
		setOutput(calculator, "card-fee", formatMoney(fee));
		setOutput(calculator, "card-points", formatNumber(points, 0));
		setOutput(calculator, "card-cpm", formatMoney(cpm));
	}

	function calculatePurchase(calculator) {
		var points = value(calculator, "points");
		var paid = value(calculator, "paid");
		var cpm = points > 0 && paid >= 0 ? (paid / points) * 1000 : NaN;
		setOutput(calculator, "cpm", formatMoney(cpm));
	}

	function filledAmount(field) {
		var amount;
		if (!field || !field.value.trim()) return null;
		amount = readNumber(field);
		return Number.isFinite(amount) ? amount : null;
	}

	function calculateTransfer(calculator) {
		var owned = filledAmount(calculator.querySelector('[name="owned"]'));
		var rate = filledAmount(calculator.querySelector('[name="rate"]'));
		var buy = filledAmount(calculator.querySelector('[name="buy"]'));
		var paid = filledAmount(calculator.querySelector('[name="paid"]'));
		var bonus = filledAmount(calculator.querySelector('[name="bonus"]'));
		var totalField = calculator.querySelector('[name="total"]');
		var ownedPoints = owned == null ? 0 : owned;
		var buyPoints = buy == null ? 0 : buy;
		var bonusRate = bonus == null ? 0 : bonus;
		var ownedCost =
			owned != null && rate != null && owned >= 0 && rate >= 0
				? (owned / 1000) * rate
				: null;
		var totalPoints =
			(owned != null || buy != null) && ownedPoints >= 0 && buyPoints >= 0
				? ownedPoints + buyPoints
				: null;
		var received =
			totalPoints != null && totalPoints >= 0 && bonusRate >= 0
				? totalPoints * (1 + bonusRate / 100)
				: null;
		var cost = 0;
		var costKnown = totalPoints != null && totalPoints > 0;
		var finalCpm;
		var formatted;

		if (ownedPoints > 0) {
			if (ownedCost == null) costKnown = false;
			else cost += ownedCost;
		}
		if (buyPoints > 0) {
			if (paid == null || paid < 0) costKnown = false;
			else cost += paid;
		}
		finalCpm = costKnown && received > 0 ? (cost / received) * 1000 : NaN;

		if (totalField) {
			if (ownedCost == null) {
				totalField.value = "";
				totalField.dataset.moneyValue = "";
			} else {
				formatted = formatMoneyInput(String(Math.round(ownedCost * 100)));
				totalField.value = formatted;
				totalField.dataset.moneyValue = formatted;
			}
		}

		setOutput(
			calculator,
			"total-points",
			totalPoints == null ? "—" : formatNumber(totalPoints, 0),
		);
		setOutput(
			calculator,
			"received",
			received == null ? "—" : formatNumber(received, 0),
		);
		setOutput(calculator, "final-cpm", formatMoney(finalCpm));
	}

	function calculateEmission(calculator) {
		var miles = value(calculator, "miles");
		var cashFare = value(calculator, "cash-fare");
		var fees = value(calculator, "fees");
		var ownCpm = value(calculator, "own-cpm");

		var redemptionValue =
			miles > 0 && cashFare >= 0 && fees >= 0
				? ((cashFare - fees) / miles) * 1000
				: NaN;
		var realCost =
			miles > 0 && ownCpm >= 0 && fees >= 0
				? (miles / 1000) * ownCpm + fees
				: NaN;
		var savings =
			Number.isFinite(realCost) && cashFare >= 0 ? cashFare - realCost : NaN;
		var savingsPct =
			cashFare > 0 && Number.isFinite(savings)
				? (savings / cashFare) * 100
				: NaN;

		setOutput(calculator, "redemption-value", formatMoney(redemptionValue));
		setOutput(calculator, "real-cost", formatMoney(realCost));
		setOutput(calculator, "savings", formatMoney(savings));
		setOutput(
			calculator,
			"savings-pct",
			Number.isFinite(savingsPct) ? `${formatNumber(savingsPct, 2)}%` : "—",
		);
		setNegative(calculator, "savings", savings < 0);
		setNegative(calculator, "savings-pct", savingsPct < 0);
	}

	function optionalPoints(calculator, name) {
		var field = calculator.querySelector(`[name="${name}"]`);
		var points;
		if (!field || !field.value.trim()) return null;
		points = readNumber(field);
		return points > 0 ? points : null;
	}

	function optionalAmount(calculator, name) {
		var field = calculator.querySelector(`[name="${name}"]`);
		var amount;
		if (!field || !field.value.trim()) return null;
		amount = readNumber(field);
		return Number.isFinite(amount) && amount >= 0 ? amount : null;
	}

	function legCost(points, taxes, reference) {
		var hasPoints = points != null;
		if (!hasPoints && taxes == null) return NaN;
		if (hasPoints && !Number.isFinite(reference)) return NaN;
		return ((hasPoints ? points : 0) / 1000) * (hasPoints ? reference : 0) +
			(taxes != null ? taxes : 0);
	}

	function showSavings(calculator, key, amount, percent) {
		var pct = calculator.querySelector(`[data-output="savings-pct-${key}"]`);
		var ready = Number.isFinite(amount) && Number.isFinite(percent);
		setOutput(calculator, `savings-${key}`, formatMoney(amount));
		if (pct) {
			pct.textContent = ready ? `(${formatNumber(percent, 2)}%)` : "";
			pct.hidden = !ready;
		}
		setNegative(calculator, `savings-${key}`, amount < 0);
	}

	function pointsText(points) {
		return points != null ? `${formatNumber(points, 0)} pontos` : "";
	}

	function showChoice(calculator, key, savings, points) {
		var image = calculator.querySelector(`[data-choice-image="${key}"]`);
		var label = calculator.querySelector(`[data-summary="choice-${key}"]`);
		var empty = calculator.querySelector(`[data-output="choice-${key}-empty"]`);
		var kind = "";
		if (Number.isFinite(savings)) {
			if (savings > 0.004) kind = "pontos";
			else if (savings < -0.004) kind = "dinheiro";
			else kind = "igual";
		}
		if (image) {
			var src =
				kind === "pontos"
					? image.dataset.srcPontos
					: kind === "dinheiro"
						? image.dataset.srcDinheiro
						: "";
			image.hidden = !src;
			if (src) {
				image.src = src;
				image.alt = kind === "pontos" ? "Pontos" : "Dinheiro";
			} else {
				image.removeAttribute("src");
				image.alt = "";
			}
		}
		if (label) {
			label.textContent =
				kind === "pontos"
					? points != null
						? `usando ${pointsText(points)}`
						: "usando pontos"
					: kind === "dinheiro"
						? "usando dinheiro"
						: "";
		}
		if (empty) empty.hidden = kind !== "";
	}

	function calculateAward(calculator) {
		var programField = calculator.querySelector('[name="program"]');
		var programOption = programField?.selectedOptions?.[0];
		var officialReference = officialMileReference(programOption);
		var programValue =
			programOption && programOption.value ? programOption.value : "";
		var programName =
			programOption && programOption.value
				? programOption.textContent.trim()
				: "";
		var cabinField = calculator.querySelector('[name="cabin"]');
		var cabinOption = cabinField?.selectedOptions?.[0];
		var cabinName =
			cabinOption && cabinOption.value ? cabinOption.textContent.trim() : "";
		var note = calculator.querySelector("[data-reference-note]");
		var referenceField = calculator.querySelector('[name="reference-rate"]');
		var referenceCents;
		var referenceFormatted;
		if (
			referenceField &&
			referenceField.dataset.filledProgram !== programValue
		) {
			referenceField.dataset.filledProgram = programValue;
			if (Number.isFinite(officialReference)) {
				referenceCents = String(Math.round(officialReference * 100));
				referenceFormatted = formatMoneyInput(referenceCents);
				referenceField.value = referenceFormatted;
				referenceField.dataset.moneyValue = referenceFormatted;
			} else {
				referenceField.value = "";
				referenceField.dataset.moneyValue = "";
			}
		}
		var usedReference = optionalAmount(calculator, "reference-rate");
		var reference = usedReference != null ? usedReference : NaN;
		var outbound = optionalPoints(calculator, "points-out");
		var inbound = optionalPoints(calculator, "points-back");
		var outboundFees = optionalAmount(calculator, "fees-out");
		var inboundFees = optionalAmount(calculator, "fees-back");
		var outboundCash = optionalAmount(calculator, "cash-out");
		var inboundCash = optionalAmount(calculator, "cash-back");
		var outboundValue = legCost(outbound, outboundFees, reference);
		var inboundValue = legCost(inbound, inboundFees, reference);
		var totalValue =
			Number.isFinite(outboundValue) || Number.isFinite(inboundValue)
				? (Number.isFinite(outboundValue) ? outboundValue : 0) +
					(Number.isFinite(inboundValue) ? inboundValue : 0)
				: NaN;
		var detail = calculator.querySelector('[data-summary="detail"]');
		var outboundPoints = calculator.querySelector(
			'[data-summary="outbound-points"]',
		);
		var inboundPoints = calculator.querySelector(
			'[data-summary="inbound-points"]',
		);
		var outboundSavingsNote = calculator.querySelector(
			'[data-summary="savings-note-out"]',
		);
		var inboundSavingsNote = calculator.querySelector(
			'[data-summary="savings-note-back"]',
		);
		var cashTotal =
			outboundCash == null && inboundCash == null
				? NaN
				: (outboundCash != null ? outboundCash : 0) +
					(inboundCash != null ? inboundCash : 0);
		var outboundReady =
			outboundCash != null && outbound != null && Number.isFinite(outboundValue);
		var inboundReady =
			inboundCash != null && inbound != null && Number.isFinite(inboundValue);
		var outboundSavings = outboundReady ? outboundCash - outboundValue : NaN;
		var inboundSavings = inboundReady ? inboundCash - inboundValue : NaN;
		var outboundSavingsPct =
			Number.isFinite(outboundSavings) && outboundCash > 0
				? (outboundSavings / outboundCash) * 100
				: NaN;
		var inboundSavingsPct =
			Number.isFinite(inboundSavings) && inboundCash > 0
				? (inboundSavings / inboundCash) * 100
				: NaN;
		var pendingNote =
			"Preencha os pontos e o milheiro do trecho para comparar.";

		if ((outbound != null || inbound != null) && !Number.isFinite(reference)) {
			totalValue = NaN;
		}
		if (note) note.classList.toggle("is-blank", !Number.isFinite(officialReference));
		setOutput(
			calculator,
			"reference",
			Number.isFinite(officialReference) ? formatMoney(officialReference) : "—",
		);
		setOutput(calculator, "outbound", formatMoney(outboundValue));
		setOutput(calculator, "inbound", formatMoney(inboundValue));
		setOutput(calculator, "total", formatMoney(totalValue));
		setOutput(
			calculator,
			"cash-outbound",
			outboundCash != null ? formatMoney(outboundCash) : "—",
		);
		setOutput(
			calculator,
			"cash-inbound",
			inboundCash != null ? formatMoney(inboundCash) : "—",
		);
		setOutput(calculator, "cash", formatMoney(cashTotal));
		var totalSavings =
			outboundReady || inboundReady
				? (outboundReady ? outboundSavings : 0) +
					(inboundReady ? inboundSavings : 0)
				: NaN;
		var comparedCash =
			(outboundReady ? outboundCash : 0) + (inboundReady ? inboundCash : 0);
		var totalSavingsPct =
			Number.isFinite(totalSavings) && comparedCash > 0
				? (totalSavings / comparedCash) * 100
				: NaN;
		var pointsUsed =
			(outboundSavings > 0.004 && outbound != null ? outbound : 0) +
			(inboundSavings > 0.004 && inbound != null ? inbound : 0);
		showSavings(calculator, "out", outboundSavings, outboundSavingsPct);
		showSavings(calculator, "back", inboundSavings, inboundSavingsPct);
		showSavings(calculator, "total", totalSavings, totalSavingsPct);
		if (outboundSavingsNote) {
			outboundSavingsNote.textContent =
				outboundCash != null && !outboundReady ? pendingNote : "";
		}
		if (inboundSavingsNote) {
			inboundSavingsNote.textContent =
				inboundCash != null && !inboundReady ? pendingNote : "";
		}
		showChoice(calculator, "out", outboundSavings, outbound);
		showChoice(calculator, "back", inboundSavings, inbound);
		showChoice(
			calculator,
			"total",
			totalSavings,
			pointsUsed > 0 ? pointsUsed : null,
		);

		var logo = calculator.querySelector("[data-program-logo]");
		var logoFallback = calculator.querySelector('[data-output="program-empty"]');
		var logoSrc = programOption ? programOption.dataset.logo : "";
		var totalPoints =
			outbound != null || inbound != null
				? (outbound != null ? outbound : 0) + (inbound != null ? inbound : 0)
				: NaN;
		if (logo) {
			logo.hidden = !logoSrc;
			if (logoSrc) {
				logo.src = logoSrc;
				logo.alt = programName;
			} else {
				logo.removeAttribute("src");
				logo.alt = "";
			}
		}
		if (logoFallback) logoFallback.hidden = Boolean(logoSrc);
		var medal = calculator.querySelector("[data-class-medal]");
		var className = calculator.querySelector('[data-summary="class-name"]');
		var classEmpty = calculator.querySelector('[data-output="class-empty"]');
		var medalSrc = cabinOption ? cabinOption.dataset.medal || "" : "";
		if (medal) {
			medal.hidden = !medalSrc;
			if (medalSrc) {
				medal.src = medalSrc;
				medal.alt = cabinName;
			} else {
				medal.removeAttribute("src");
				medal.alt = "";
			}
		}
		if (className) className.textContent = cabinName;
		if (classEmpty) classEmpty.hidden = Boolean(medalSrc);
		if (outboundPoints) outboundPoints.textContent = pointsText(outbound);
		if (inboundPoints) inboundPoints.textContent = pointsText(inbound);
		if (detail) {
			detail.textContent = Number.isFinite(totalPoints)
				? pointsText(totalPoints)
				: "";
		}
	}

	function filledNumber(calculator, name) {
		var field = calculator.querySelector(`[name="${name}"]`);
		var amount;
		if (!field || !field.value.trim()) return null;
		amount = readNumber(field);
		return Number.isFinite(amount) ? amount : null;
	}

	function fillAccorProgram(calculator) {
		var programField = calculator.querySelector('[name="program"]');
		var option =
			programField && programField.selectedOptions
				? programField.selectedOptions[0]
				: null;
		var programValue = option && option.value ? option.value : "";
		var officialReference = officialMileReference(option);
		var officialRatio = option ? Number(option.dataset.ratio) : NaN;
		var cpmField = calculator.querySelector('[name="cpm"]');
		var ratioField = calculator.querySelector('[name="ratio"]');
		var referenceNote = calculator.querySelector("[data-reference-note]");
		var ratioNote = calculator.querySelector("[data-ratio-note]");
		var cents;
		var formatted;

		if (cpmField && cpmField.dataset.filledProgram !== programValue) {
			cpmField.dataset.filledProgram = programValue;
			if (Number.isFinite(officialReference)) {
				cents = String(Math.round(officialReference * 100));
				formatted = formatMoneyInput(cents);
				cpmField.value = formatted;
				cpmField.dataset.moneyValue = formatted;
			} else {
				cpmField.value = "";
				cpmField.dataset.moneyValue = "";
			}
		}
		if (ratioField && ratioField.dataset.filledProgram !== programValue) {
			ratioField.dataset.filledProgram = programValue;
			ratioField.value =
				Number.isFinite(officialRatio) && officialRatio > 0
					? formatIntegerInput(String(Math.round(officialRatio)))
					: "";
		}
		if (referenceNote) {
			referenceNote.classList.toggle(
				"is-blank",
				!Number.isFinite(officialReference),
			);
		}
		if (ratioNote) {
			ratioNote.classList.toggle("is-blank", !(officialRatio > 0));
		}
		setOutput(
			calculator,
			"reference",
			Number.isFinite(officialReference) ? formatMoney(officialReference) : "—",
		);
		setOutput(
			calculator,
			"ratio-reference",
			officialRatio > 0 ? formatPoints(officialRatio) : "—",
		);
	}

	function calculateAccor(calculator) {
		var miles;
		var cpm;
		var ratio;
		var promoBonus;
		var euroBlock;
		var fx;
		var mileCost = NaN;
		var result;

		fillAccorProgram(calculator);
		miles = filledNumber(calculator, "miles");
		cpm = filledNumber(calculator, "cpm");
		ratio = filledNumber(calculator, "ratio");
		promoBonus = filledNumber(calculator, "promo-bonus");
		euroBlock = filledNumber(calculator, "euro-block");
		fx = filledNumber(calculator, "fx");

		if (promoBonus == null) promoBonus = 0;
		if (!(euroBlock > 0)) euroBlock = euroBlock == null ? 20 : euroBlock;
		if (cpm != null && cpm >= 0 && miles > 0) mileCost = (miles / 1000) * cpm;

		function scenario(bonusRate) {
			var rate = 1 + bonusRate / 100;
			var base =
				miles > 0 && ratio > 0 ? (miles / ratio) * 1000 : NaN;
			var received = Number.isFinite(base) ? base * rate : NaN;
			var credit =
				Number.isFinite(received) && euroBlock > 0
					? (received / 1000) * euroBlock
					: NaN;
			var cost = mileCost;
			var nominal =
				Number.isFinite(credit) && fx != null && fx >= 0 ? credit * fx : NaN;

			return {
				received: received,
				credit: credit,
				cost: cost,
				nominal: nominal,
			};
		}

		result = scenario(promoBonus);
		var mileReal =
			euroBlock > 0 && fx != null && fx >= 0 ? euroBlock * fx : NaN;
		var bonusRate = 1 + promoBonus / 100;
		var mileNow =
			ratio > 0 && cpm != null && cpm >= 0 && bonusRate > 0
				? ((ratio / 1000) * cpm) / bonusRate
				: NaN;
		var mileNowEuro =
			Number.isFinite(mileNow) && fx != null && fx > 0 ? mileNow / fx : NaN;
		setOutput(calculator, "received", formatPoints(result.received));
		setOutput(
			calculator,
			"credit",
			Number.isFinite(result.nominal)
				? `${formatEuro(result.credit)} ~ ${formatMoney(result.nominal)}`
				: formatEuro(result.credit),
		);
		setOutput(
			calculator,
			"cost",
			miles > 0 ? `${formatPoints(miles)} pontos` : "—",
		);
		setOutput(calculator, "cost-points", formatMoney(result.cost));
		setOutput(calculator, "mile-euro", formatEuro(euroBlock > 0 ? euroBlock : NaN));
		setOutput(calculator, "mile-real", formatMoney(mileReal));
		var discount =
			Number.isFinite(mileReal) && mileReal > 0 && Number.isFinite(mileNow)
				? ((mileReal - mileNow) / mileReal) * 100
				: NaN;
		setOutput(calculator, "mile-now", formatEuro(mileNowEuro));
		setOutput(calculator, "mile-now-euro", formatMoney(mileNow));
		setOutput(
			calculator,
			"discount",
			Number.isFinite(discount) ? `${formatNumber(discount, 2)}%` : "—",
		);
		setNegative(calculator, "discount", discount < 0);
	}

	function calculateAccorStay(calculator) {
		var hotel = filledNumber(calculator, "stay");
		var rewards = filledNumber(calculator, "rewards");
		var official = filledNumber(calculator, "reward-cpm");
		var fx = filledNumber(calculator, "fx");
		var mine = filledNumber(calculator, "reward-cpm-mine");
		var credit;
		var discounted;
		var pointCost;
		var hotelDue;
		var totalPaid;
		var discountMoney;
		var discountPct;

		if (!(official > 0)) official = official == null ? 20 : official;
		credit =
			rewards != null &&
			rewards >= 0 &&
			official > 0 &&
			fx != null &&
			fx >= 0
				? (rewards / 1000) * official * fx
				: NaN;
		discounted =
			hotel != null && hotel >= 0 && Number.isFinite(credit)
				? hotel - credit
				: NaN;
		pointCost =
			rewards > 0 && mine != null && mine >= 0 && fx != null && fx >= 0
				? (rewards / 1000) * mine * fx
				: NaN;
		hotelDue = Number.isFinite(discounted) && discounted > 0 ? discounted : 0;
		totalPaid =
			Number.isFinite(discounted) && Number.isFinite(pointCost)
				? hotelDue + pointCost
				: NaN;
		discountMoney =
			hotel != null && hotel >= 0 && Number.isFinite(totalPaid)
				? hotel - totalPaid
				: NaN;
		discountPct =
			hotel > 0 && Number.isFinite(discountMoney)
				? (discountMoney / hotel) * 100
				: NaN;

		setOutput(
			calculator,
			"stay-discount-note",
			Number.isFinite(credit)
				? `- ${formatMoney(credit)} (desconto usando pontos)`
				: "- R$ 0,00 (desconto usando pontos)",
		);
		setOutput(calculator, "stay-discounted", formatMoney(discounted));
		setOutput(
			calculator,
			"stay-cost-note",
			Number.isFinite(pointCost)
				? `+ ${formatMoney(pointCost)} (custos dos pontos Reward)`
				: "+ R$ 0,00 (custos dos pontos Reward)",
		);
		setOutput(calculator, "stay-cost", formatMoney(totalPaid));
		setOutput(
			calculator,
			"discount-pct",
			Number.isFinite(discountPct) ? `${formatNumber(discountPct, 2)}%` : "—",
		);
		setOutput(calculator, "discount-money", formatMoney(discountMoney));
		setNegative(calculator, "stay-discounted", discounted < 0);
		setNegative(calculator, "discount-pct", discountPct < 0);
	}

	function ptaxUrl(currency, date) {
		var month = String(date.getMonth() + 1).padStart(2, "0");
		var day = String(date.getDate()).padStart(2, "0");
		var stamp = `${month}-${day}-${date.getFullYear()}`;
		return (
			"https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
			"CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)" +
			`?@moeda='${currency}'&@dataCotacao='${stamp}'&$top=100&$format=json` +
			"&$select=cotacaoVenda,dataHoraCotacao"
		);
	}

	function formatPtaxWhen(value) {
		var parts = String(value).split(/[\s:-]/);
		if (parts.length < 5) return "";
		return `${parts[2]}/${parts[1]}/${parts[0]} ${parts[3]}:${parts[4]}h`;
	}

	function readPtax(currency, offset) {
		var date;
		if (offset > 6) return Promise.resolve(null);
		date = new Date();
		date.setHours(12, 0, 0, 0);
		date.setDate(date.getDate() - offset);
		return fetch(ptaxUrl(currency, date))
			.then((response) => {
				if (!response.ok) throw new Error("ptax");
				return response.json();
			})
			.then((data) => {
				var rows = data && data.value ? data.value : [];
				var latest = null;
				rows.forEach((row) => {
					var rate = Number(row.cotacaoVenda);
					if (!(rate > 0)) return;
					if (
						!latest ||
						String(row.dataHoraCotacao) > String(latest.dataHoraCotacao)
					) {
						latest = row;
					}
				});
				if (!latest) return readPtax(currency, offset + 1);
				return {
					rate: Number(latest.cotacaoVenda),
					label: formatPtaxWhen(latest.dataHoraCotacao),
				};
			})
			.catch(() => readPtax(currency, offset + 1));
	}

	function bindFxLookup() {
		document.querySelectorAll("[data-fx-lookup]").forEach((button) => {
			button.addEventListener("click", () => {
				var calculator = button.closest("[data-calculator]");
				var lookup = button.closest(".fx-lookup");
				var fieldWrap = button.closest(".calculator-field");
				var field = lookup ? lookup.querySelector("input") : null;
				var note = fieldWrap
					? fieldWrap.querySelector("[data-fx-note]")
					: null;
				var currency = button.dataset.fxCurrency === "USD" ? "USD" : "EUR";
				var formatted;
				if (!calculator || !field || button.disabled) return;
				button.disabled = true;
				readPtax(currency, 0)
					.then((quote) => {
						if (!quote) return;
						formatted = formatMoneyInput(
							String(Math.round(quote.rate * 100)),
						);
						field.value = formatted;
						field.dataset.moneyValue = formatted;
						field.dispatchEvent(new Event("input", { bubbles: true }));
						if (note) {
							note.textContent = `${quote.label} - ${formatMoney(quote.rate)}`;
							note.classList.remove("is-blank");
						}
					})
					.finally(() => {
						button.disabled = false;
					});
			});
		});
	}

	function addSymbolPrefix(input, symbol, extraClass) {
		var parent = input.parentElement;
		var wrap = parent;
		var mark = document.createElement("span");
		if (!parent || parent.querySelector(":scope > .money-prefix")) return;
		if (!parent.classList.contains("fx-lookup")) {
			wrap = document.createElement("div");
			wrap.className = "money-input";
			input.replaceWith(wrap);
			wrap.appendChild(input);
		} else {
			parent.classList.add("money-input");
		}
		if (extraClass) wrap.classList.add(extraClass);
		mark.className = "money-prefix";
		mark.setAttribute("aria-hidden", "true");
		mark.textContent = symbol;
		wrap.insertBefore(mark, input);
	}

	function addMoneyPrefix(input) {
		if (input.dataset.prefix === "euro") return;
		addSymbolPrefix(input, "R$");
	}

	document
		.querySelectorAll('input[data-mask="money"]')
		.forEach(addMoneyPrefix);
	document
		.querySelectorAll('input[name="euro-block"], input[data-prefix="euro"]')
		.forEach((input) => addSymbolPrefix(input, "€", "euro-input"));

	var calculators = document.querySelectorAll("[data-calculator]");
	calculators.forEach((calculator) => {
		var type = calculator.dataset.calculator;
		var calculate =
			type === "purchase"
				? calculatePurchase
				: type === "transfer"
					? calculateTransfer
					: type === "award"
						? calculateAward
						: type === "accor"
							? calculateAccor
							: type === "accor-stay"
								? calculateAccorStay
								: type === "credit-card"
									? calculateCreditCard
									: type === "card-miles"
										? calculateCardMiles
										: calculateEmission;

		function onEdit(event) {
			var field = event.target;
			var card;
			if (field.name === "card") applyCardPreset(calculator);
			else if (
				(field.name === "cashback" || field.name === "points") &&
				event.isTrusted
			) {
				card = calculator.querySelector('[name="card"]');
				if (card) card.value = "";
			}
			if (field.classList?.contains("calculator-input") && field.dataset.mask) {
				if (field.dataset.mask === "money") handleMoneyInput(field);
				else applyMask(field);
			}
			calculate(calculator);
		}

		calculator.querySelectorAll(".calculator-input").forEach((field) => {
			if (field.dataset.mask === "money") {
				field.dataset.moneyValue = formatMoneyInput(field.value);
				field.value = field.dataset.moneyValue;
			} else if (field.dataset.mask) {
				applyMask(field);
			}
		});
		calculator.addEventListener("input", onEdit);
		calculator.addEventListener("change", onEdit);
		calculate(calculator);
	});
	bindFxLookup();
	if (window.applyMileReferences) window.applyMileReferences();
})();
