const { label, group, join, indent, line, softline, hardline, ifBreak, breakParent } = require('prettier').doc.builders;

function print_groq(path, options, print) {
	const node = path.getValue();
	const ß = key => path.call(print, key);
	const ßß = key => path.map(print, key);

	function is_parent_type(type) {
		return !path.getParentNode() ? false : path.getParentNode().type === type;
	}

	function group_value_type(type) {
		if (['OpCall', 'FuncCall', 'Parameter', 'Array'].includes(type)) {
			return 'Value';
		}

		if (['Slice', 'PipeFuncCall'].includes(type)) {
			return 'Filter';
		}

		return type;
	}

	function return_last_node_name(node) {
		return node.base ? return_last_node_name(node.base) : node.name;
	}

	function return_value(node) {
		const in_quotes = options.singleQuote ? `'${node.value}'` : `"${node.value}"`;
		return node.value === null ? 'null' : typeof node.value === 'string' ? in_quotes : node.value.toString();
	}

	switch (node.type) {
		case 'Star':
			return '*';

		case 'Parent':
			return '^';

		case 'This':
			return label(node.type, is_parent_type('ObjectSplat') ? '' : '@');

		case 'Value':
			return label(node.type, return_value(node));

		case 'Identifier':
			return label(node.type, node.name);

		case 'Parameter':
			return label(node.type, ['$', node.name]);

		case 'Element':
			return label(node.type, [ß('base'), ' [', ß('index'), ']']);

		case 'Mapper':
			return label(node.type, [ß('base'), '[]']);

		case 'Attribute':
			const is_base_deref = node.base.type === 'Deref';
			return label(node.type, [ß('base'), is_base_deref ? '' : '.', node.name]);

		case 'Deref':
			return label(node.type, [ß('base'), '->']);

		case 'Asc':
			return label(node.type, [ß('base'), ' asc']);

		case 'Desc':
			return label(node.type, [ß('base'), ' desc']);

		case 'Parenthesis':
			return label(node.type, ['(', ß('base'), ')']);

		case 'Not':
			return label(node.type, ['!', ß('base')]);

		case 'ObjectSplat':
			return label(node.type + node.value.type, ['...', ß('value')]);

		case 'ObjectConditionalSplat':
			return label(node.type + group_value_type(node.value.type), [ß('condition'), ' => ', ß('value')]);

		case 'OpCall':
			return label(node.type, [ß('left'), ` ${node.op} `, ß('right')]);

		case 'Pair':
			return label(node.type, [ß('left'), ' => ', ß('right')]);

		case 'Slice':
			return label(node.type, [ß('base'), ' [', ß('left'), node.isExclusive ? '...' : '..', ß('right'), ']']);

		case 'Filter':
			return label(node.type, group([ß('base'), '[', indent([softline, ß('query')]), softline, ']']));

		case 'Projection':
			return label(node.type, group([ß('base'), ' {', indent([line, ß('query')]), line, '}']));

		case 'And':
		case 'Or':
			const operators = { And: '&& ', Or: '|| ' };
			const query = [ß('left'), is_parent_type('Parenthesis') ? ' ' : line, operators[node.type], ß('right')];
			return is_parent_type('ObjectConditionalSplat') ? label(node.type, group(query)) : label(node.type, query);

		/* prettier-ignore */
		case 'FuncCall':
			const select_exception = node.name === 'select' ? hardline : line;
			return label(node.type, group([node.name, '(', indent([softline, join([',', select_exception], ßß('args'))]), softline, ')']));

		/* prettier-ignore */
		case 'PipeFuncCall':
			return node.name === 'order'
				? label(node.type, group([ß('base'), ' | ', node.name, '(', indent([join([', '], ßß('args'))]), ')']))
				: label(node.type, group([ß('base'), ' | ', node.name, '(', indent([softline, join([',', line], ßß('args'))]), softline, ')']));

		case 'Array':
			return label(node.type, group(['[', indent([softline, join([',', line], ßß('elements'))]), softline, ']']));

		case 'ArrayElement':
			return label(node.type, node.isSplat ? ['...', ß('value')] : ß('value'));

		case 'Object':
			const attributes = ßß('attributes');

			attributes.forEach((attribute, i, a) => {
				if (a.length > 1 && i < a.length - 1) {
					const next = a[i + 1];

					attribute.contents.push(',');

					if (next && next.label === attribute.label) {
						if (options.groqInlineShorthandProperties && attribute.label.endsWith('Identifier')) {
							attribute.contents.push(' ');
						} else {
							attribute.contents.push(line);

							if (attribute.label.endsWith('Projection') || attribute.label.endsWith('Object')) {
								attribute.contents.push(hardline);
							}
						}
					} else {
						if (attribute.label === 'ObjectSplatThis' && i === 0 && attributes.length === 2) {
							attribute.contents.push(' ');
						} else {
							attribute.contents.push(hardline, hardline);
						}
					}
				}
			});

			return is_parent_type('Projection')
				? label(node.type, group([attributes, breakParent]))
				: label(node.type, group(['{', indent([line, attributes, breakParent]), line, '}']));

		case 'ObjectAttribute':
			const is_attribute_value = node.value.type === 'Attribute';
			const is_base_projection = node.value.base && node.value.base.type === 'Projection';
			const is_equal_pair = node.key.value === return_last_node_name(node.value);
			const should_merge_pair = is_equal_pair && !is_attribute_value;

			const value_type_override = (() => {
				if (is_attribute_value && is_base_projection) {
					return 'AttributeAccessProjection';
				}

				return node.value.type;
			})();

			return label(
				node.type + group_value_type(value_type_override),
				should_merge_pair ? [ß('value')] : [ß('key'), ': ', ß('value')]
			);

		default:
			return '';
	}
}

exports.print = print_groq;
